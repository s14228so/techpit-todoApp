
# はじめに
昨今SPAの爆発的人気に伴い、Rails単体のようなモノリシックなアプリケーションではなく、
SPAとAPIをそれぞれ用意しフロントとバックエンドを完全に分離する開発手法がトレンドでもあります。
バックエンドをAPIとして開発していれば、ネイティブを開発する時も同じAPIを使える、分業しやすいなど多くのメリットがあると思います。
ただ、ReactやVueでSPAの開発手法はある程度理解していても、これを実際にどうAPIと連携しながら開発していくのかを解説する教材はまだまだ少ないです。
今回はバックエンドにRails API、フロントはNuxt、認証はFirebaseを使いますが、
あくまでバックエンドとフロントエンドを分けて開発してそれをどう連携させるのかを理解することが重要です。


## こんな方におすすめ
・フロントエンドとバックエンドを分けて開発する手法を学びたい方。
・めっちゃ記事が長いので根性がある方

## 環境

Mac 
Rails 6.0.2.1
ruby 2.5.3
npm 6.13.4


## この記事を読むにあたっての前提
・Railsで何かしらのアプリケーションを作成したことがある
・JavaScript及びVue.jsの基本知識がある
・NuxtやVuexの知識があると尚良いです。
(ほぼVue,Nuxt,Vuexの説明は割愛させていただきます🙇‍♂️）

## 完成品
https://qiita-todo.firebaseapp.com

## GitHubのリポジトリ
Github => https://github.com/s14228so/Qiita-todo


## 目次

| 目次        |   
|:-------------------|
| 1. プロジェクトの作成  |                       
| 2. Rails APIの責務    |           
| 3. コンポーネントの作成 |           
| 4.  Firebase Authentication  |    
| 5.  CORSによる通信  |             
| 6. ログイン状態の保持(vuex)   |  
| 7. Loadingコンポーネントの作成  |  
| 8. SuccessMessageの表示 |  
| 9. ナビゲーションガード  |  
| 10. HerokuとFirebaseへのデプロイ   |           


# プロジェクトの作成
さあここから実装に入っていきます、かなり長いですがお付き合いください！

```
$ mkdir todoApp; cd $_
$ rails new api --api (RailsをAPIで作る)
$ npx create-nuxt-app web (Nuxtのプロジェクト作成)
```


Nuxtのプロジェクト作成時に色々質問を聞かれますが、以下の質問だけスペースキーを押して選択します

```
? Choose UI framework => Vuetify.js
? Choose Nuxt.js modules => Axios
? Choose rendering mode => Single Page App
```

CSSフレームワークは[Vuetify](https://vuetifyjs.com/ja/)を選びます。
[axios](https://github.com/axios/axios)はRailsのAPIと通信するために使うので予め入れておきます。今回SSRは不要なのでSPAモードで作成します。


他の質問はEnterを押しておけばで大丈夫です。

今回わかりやすくわざと上の階層でディレクトリを切りGithubも同一のリポジトリにしていますが(monorepo構成)、皆さんは別のリポジトリにしてもらって構いません。
同一リポジトリとして管理したいので、
railsとnuxtで自動生成されているgitを削除します。

```
$ rm -rf api/.git web/.git
```


さあ、下準備ができたのでターミナルを二つ開いて、各ディレクトリに移動し、バックエンドとフロントエンドの二つのサーバを立ち上げましょう。

この時注意しなければいけないことが1つあります。
NuxtもRailsもデフォルトで3000番ポートを使用する仕様なので、
Nuxtのポートは8080にして衝突しないようにしておく必要があります。


開発用サーバのポート番号を変更するには
nuxt.config.jsに以下の3行を追加します。

nuxt.config.js
```
import colors from 'vuetify/es5/util/colors'

export default {
  server: {　// <= 追加
    port: 8080 
  },
```

さあ、二つのサーバを立ち上げましょう。

```
api $ rails s
web $ npm run dev
```


<img width="1431" alt="スクリーンショット 2020-01-02 23.56.55.png" src="https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/251768/e4888544-cf76-326f-c33c-fa56effd15e1.png">
<img width="1422" alt="スクリーンショット 2020-01-02 23.56.47.png" src="https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/251768/35c6ec7e-97a6-8d36-8dcc-2e0b14e4e32f.png">

立ち上げるとこんな感じになります。


## RailsでAPIを作成していく

```
api $ rails g model Todo title:string user_id:integer
api $ rails g controller v1::todos 
api $ rails g model User name:string email:string uid:string
api $ rails g controller v1::users 
api $ rails db:migrate
```

※v1という名前空間で区切ることで、APIのバージョンを与えています。

アソシエーションを組みます。

```models/user.rb
class User < ApplicationRecord
    has_many :todos
end
```

```models/todo.rb
class Todo < ApplicationRecord
    belongs_to :user
end
```

今回バリデーションなどは省略します。

```routes.rb
Rails.application.routes.draw do
  namespace :v1 do
    resources :todos, only: [:create, :destroy]
    resources :users, only: [:index, :create]
  end
end
```



# Rails APIの責務

Rails単体でアプリケーションを作成していると、ブラウザからのリクエストに対して**HTML**を返していました。今回はリクエストがNuxtのアプリケーションからのリクエストなので、HTMLではなく**データ**を返します。
すなわち**json**を返す必要があります。

何かしら今まで作成してきたRailsのアプリケーションを起動させてディベロッパーツールのNetworkタブを確認すると理解しやすいと思います。
ディベロッパーツールを開く⇨Networkタブをクリック⇨localhostをクリック⇨Responceタブ
個別のHTMLファイルがレスポンスとして返ってきていることを確認できたでしょうか。
<img width="1435" alt="スクリーンショット 2020-01-05 9.07.29.png" src="https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/251768/d5e29aba-2ff7-c45a-45cf-b5e65eea6f52.png">


json形式のレスポンスを返すために便利なGem[ActiveModelSerializers](https://github.com/rails-api/active_model_serializers)を入れます。

```Gemfile.rb
gem 'active_model_serializers'
```


```terminal
api $ bundle install
api $ rails g serializer user //Userモデル用のserializerを作成
api $ rails g serializer todo　//Todoモデル用のserializerを作成
```


```serializers/user_serializer.rb
class UserSerializer < ActiveModel::Serializer
  attributes :id, :name, :email
  has_many :todos 
end
```
ここでhas_many :todos と書くことでそのユーザーに関連するTodoレコードも一緒に配列でjsonに含んでくれます。


```serializers/todo_serializer.rb
class TodoSerializer < ActiveModel::Serializer
  attributes :id, :title, :user_id, :username
  belongs_to :user

  def username
    object.user.name
  end
end
```
同様にbelongs_to :userと書くことでそのTodoに関連するUserレコードも一緒にオブジェクトでjsonに含んでくれます。
object.user.nameでusernameを定義し、それをtodoのattributesに追加することで、ユーザー名も一緒に返すようにしています。


## コントローラの記述
今回は最低限のアクションしか作成していません。適宜加えてください。
ここの説明は省略します。renderの後に**json**を指定しているところがポイントです。
renderの後に何も指定しないとデフォルトでhtmlを返すので今まではHTMLファイルを返していた感じです。

```v1/todos_controller.rb
class V1::TodosController < ApplicationController
    def create
      todo = Todo.new(todo_params)
      if todo.save
        render json: todo, status: :created
      else
        render json: todo.errors, status: :unprocessable_entity
      end
    end

    def destroy
      todo = Todo.find(params[:id])
      if todo.destroy
        render json: todo
      end
    end
  
    private

    def todo_params
      params.require(:todo).permit(:title, :user_id)
    end
end

```



```v1/users_controller.rb
class V1::UsersController < ApplicationController
    def index
        users = User.all
        render json: users
    end

    def create
      user = User.new(user_params)
      if user.save
        render json: user, status: :created
      else
        render json: user.errors, status: :unprocessable_entity
      end
    end

    private

    def user_params
      params.require(:user).permit(:email, :uid, :name)
    end
end
```

これで最低限jsonを返すAPIサーバが完成しました。

http://localhost:3000/v1/users
にアクセスして[]という空の配列が表示されていればOKです！


※　今後のためにJSONViewというChrome拡張を入れておくのがおすすめです。
ブラウザ上でjsonを表示する際に勝手に整形してくれるツールです。
https://chrome.google.com/webstore/detail/jsonview/chklaanhfefbnpoihckbnefhakgolnmc


# Nuxt側でコンポーネントの作成
Nuxtの自動ルーティングについては[公式](https://ja.nuxtjs.org/guide/routing/)を読んでください。
ざっくり言うとpagesディレクトリにファイルを置くと自動でルーティングしてくれます。
(例)
pages/about.vue => localhost:3000/about
pages/users/_id.vue => localhost:3000/users/:id

ビルドされた**.nuxtフォルダ**に**router.js**というファイルが作成されていると思いますが、そこを見ればvue-routerを使ったことある人は理解できるはずです。


とりあえず不要なpages/index.vueの中身を全て削除し、
以下のように修正します。
もちろん今の段階ではそんなファイルは見つからないよと言われますが一旦スルーで。


```pages/index.vue
<template>
  <div>
    <AddTodo />
    <TodoList />
  </div>
</template>

<script>
import AddTodo from "@/components/AddTodo";
import TodoList from "@/components/TodoList";

export default {
  components: {
    AddTodo,
    TodoList,
  },
  data() {
    return {
      todos: [],
    };
  },
};
</script>

<style>
</style>
```


## AddTodoコンポーネントとTodoListコンポーネントの作成

componentsディレクトリ配下にAddTodo.vueとTodoList.vueというファイルを作成します。
あとpages/inspire.vue, components/Logo.vue, components/VutifyLogo.vueは不要なので削除しときます。

https://vuetifyjs.com/en/components/forms#forms
を参考に

```components/AddTodo.vue
<template>
  <v-form>
    <v-container>
      <v-row>
        <v-col cols="12" md="4">
          <v-text-field
            v-model="title"
            :counter="10"
            label="todo"
            required
          ></v-text-field>
        </v-col>
        <v-col cols="12" md="4">
          <v-btn @click="handleSubmit">作成</v-btn>
        </v-col>
      </v-row>
    </v-container>
  </v-form>
</template>

<script>
export default {
  data() {
    return {
      title: "",
    };
  },
  methods: {
    handleSubmit() {
      this.title = "";
    },
  },
};
</script>

<style>
</style>

```

https://vuetifyjs.com/ja/components/data-tables#search
を参考に

```components/TodoList.vue
<template>
  <v-card>
    <v-card-title>
      Todo List
      <v-spacer></v-spacer>
      <v-text-field
        v-model="search"
        append-icon="search"
        label="Search"
        single-line
        hide-details
      ></v-text-field>
    </v-card-title>
    <v-data-table
      :headers="headers"
      :items="todos"
      :search="search"
    ></v-data-table>
  </v-card>
</template>

<script>
export default {
  data() {
    return {
      todos: [
        {
          title: "test",
          username: "太郎",
        },
      ],
      search: "",
      headers: [
        {
          text: "タイトル",
          align: "left",
          sortable: false,
          value: "title",
        },
        { text: "ユーザー名", value: "username" },
      ],
    };
  },
};
</script>

<style>
</style>
```


## <追記>searchアイコンが表示されない場合

```
web $ npm install material-design-icons-iconfont
```

plugins/vuetify.jsを作成して以下のように記述しましょう。

```javascript:plugins/vuetify.js
import 'material-design-icons-iconfont/dist/material-design-icons.css'
import Vue from 'vue'
import Vuetify from 'vuetify/lib'

Vue.use(Vuetify)

export default new Vuetify({
  icons: {
    iconfont: 'md',
  },
})

```

作成したプラグインをnuxt.config.jsのpluginsに追加します。


```javascript:nuxt.config.js
  plugins: [
    "@/plugins/vuetify", //追加
  ],

```
サーバーを立ち上げ直せば、searchアイコンが表示されるはずです。


## AddTodoで作成したTodoを親コンポーネントに伝達してTodoListで表示する
まず以下のようにしてAddTodoコンポーネントから親のpages/index.vueコンポーネントに**$emit**で渡します。


```js:components/AddTodo.vue
 methods: {
    handleSubmit() {
      this.$emit("submit", this.title);  //この行を追加
      this.title = "";
    },
  }
```

**$emit**で渡ってきたものを受け取り、コンポーネント内のtodosという配列にpushして**TodoListコンポーネント**に渡します。


```pages/index.vue
<template>
  <div>
    <AddTodo @submit="addTodo" />
    <TodoList :todos="todos" />
  </div>
</template>

<script>
import AddTodo from "@/components/AddTodo";
import TodoList from "@/components/TodoList";

export default {
  components: {
    AddTodo,
    TodoList,
  },
  data() {
    return {
      todos: [],
    };
  },
  methods: {
    addTodo(title) {
      this.todos.push({
        title // title: titleと同義
      });
    },
  },
};
</script>

<style>
</style>
```


次にTodoListコンポーネントで初期値で入れていたtodosを**props**で受け取るようにします。

```components/TodoList.vue
<template>
  <v-card>
    <v-card-title>
      Todo List
      <v-spacer></v-spacer>
      <v-text-field
        v-model="search"
        append-icon="search"
        label="Search"
        single-line
        hide-details
      ></v-text-field>
    </v-card-title>
    <v-data-table
      :headers="headers"
      :items="todos"
      :search="search"
    ></v-data-table>
  </v-card>
</template>

<script>
export default {
  props: ["todos"], // <- これ！
  data() {
    return {
      search: "",
      headers: [
        {
          text: "タイトル",
          align: "left",
          sortable: false,
          value: "title",
        },
        { text: "ユーザー名", value: "username" },
        // ここのtodosはpropsで受け取るので削除します
      ],
    };
  },
};
</script>

<style>
</style>
```


ここまででとりあえずVue.jsでTodo Appっぽいものはできましたが、
**リロードすると消えてしまいます**
今回はリロードしても大丈夫なように、DBから参照するようにしたいと思います。
そのためRailsのAPIに投げてユーザーごとにデータを保持しておきたいです。
ユーザーごとにデータを保持するには認証機能が必要になりますので、先にログイン機能の実装から入りたいと思います。
今回はログイン機能に**Firebase Authentication**を利用します。

# Firebaseプロジェクトの作成

https://firebase.google.com/?hl=ja
新しいFirebaseプロジェクトの作成をします。
プロジェクト名を入力し、アナリティクスは使わなので今回はオフで問題ありません。

## ログイン方法の追加

Authentication -> ログイン方法 -> メールアドレス/パスワードをクリックします。


<img width="1406" alt="スクリーンショット 2020-01-03 1.12.32.png" src="https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/251768/fdef2ff2-7892-938b-d7a0-060584ea17cf.png">


## プロジェクトにアプリを追加する
<img width="1374" alt="スクリーンショット 2020-01-03 1.14.39.png" src="https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/251768/5e8f1ed9-ecca-2c01-caa2-4306cd16c2f0.png">
<img width="943" alt="スクリーンショット 2020-01-03 1.16.56.png" src="https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/251768/78bdf282-5ceb-26f5-7855-851908ab0cc1.png">


2のFirebase SDKの追加は今回飛ばして大丈夫です。

<img width="888" alt="スクリーンショット 2020-01-03 1.21.32.png" src="https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/251768/9bae4b0e-303f-9a11-77d4-02cfbd683d9e.png">

デプロイする時にFirebaseコマンドを使うので
一応**Firebase CLI**をインストールしておきましょう。(どこで打っても問題ありません)

```terminal
web $ npm install -g firebase-tools
```

4の**Firebase Hosting**へのデプロイもすっ飛ばして大丈夫です。



## NuxtのプロジェクトとFirebaseプロジェクトを紐付ける

<img width="1066" alt="スクリーンショット 2020-01-03 1.24.52.png" src="https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/251768/ed25b0d1-4f2a-54a6-67cf-b890fd4d948f.png">

クリックすると設定アイコン（歯車アイコン）があるのでそちらをクリックすると
アプリの詳細画面にいけます。

下の方にスクロールしていくと**Firebase SDK Snippet**という欄があるので、
それの構成という欄をクリックします。すると以下のようなAPI_KEYなどが出てきますので、あとで使うのでこれらをコピーしておきます。
<img width="695" alt="スクリーンショット 2020-01-03 1.35.04.png" src="https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/251768/d94d52b4-bb07-3a85-5ba7-4d7ac042594d.png">


Nuxtでfirebaseが使えるようにfirebaseライブラリを入れておく。

```terminal
web $ npm install firebase
```
Nuxtの**pluginsディレクトリ**に
**firebase.js**という新規ファイルを作ります。

```plugins/firebase.js
import firebase from "firebase/app"
import "firebase/auth"

const fbConfig = {
    apiKey: process.env.API_KEY,
    authDomain: process.env.AUTH_DOMAIN,
    projectId: process.env.PROJECT_ID,
};
firebase.initializeApp(fbConfig)

export default firebase
```

ここではprocess.env.API_KEYとしていますが、
これは環境変数を用いています。
GitHubにAPI_KEYなどをそのままあげると悪用されてしまう可能性があるので、環境変数を用いてgit管理から外すようにしたいと思います。


## @nuxtjs/dotenvの導入

nuxtで環境変数を扱えるライブラリである[@nuxtjs/dotenv](https://github.com/nuxt-community/dotenv-module)をインストールします。

```terminal
web $ npm install --save-dev @nuxtjs/dotenv
web $ touch .env
```


nuxt.config.jsのbuildModules欄に@nuxtjs/dotenvを追記しましょう。

```nuxt.config.js
  buildModules: [
    '@nuxtjs/vuetify',
    '@nuxtjs/dotenv', // 追加
  ],
```

作成した.envファイルに先ほどコピーしたAPI_KEYなどを環境変数として登録します。


```/.env
API_KEY="A○○○○○○○○○○○○○○○○○○○○○k"
AUTH_DOMAIN="○○○○○○"
PROJECT_ID="○○○○○○"
```
今回は認証にしかFirebaseを使わないので記載するのは上三つだけで問題ないですが、
一応全て登録しておきます。



忘れないうちに.gitignoreに.envを追加してGit管理下から除外しておきましょう。

```/.gitignore
.env
```


```nuxt.config.js
require('dotenv').config(); // <- 追加
export default {
  mode: 'spa',
  ...
```

これで設定は完了なのですが、Nuxt内で実際にFirebaseのAPI_KEYが読み取れているか一応確認しておきましょう。

```pages/index.vue
<template>
  <div>
    <AddTodo @submit="addTodo" />
    <TodoList :todos="todos" />
  </div>
</template>

<script>
import AddTodo from "@/components/AddTodo";
import TodoList from "@/components/TodoList";

export default {
  components: {
    AddTodo,
    TodoList
  },
  created() {
     console.log("API_KEY:", process.env.API_KEY);  //<= これ追加
  },
  data() {
    return {
      todos: []
    };
  },
  methods: {
    addTodo(title) {
      this.todos.push({
        title
      });
    }
  }
};
</script>

<style>
</style>
```

ディベロッパーツールのconsoleで以下のように自分のAPI_KEYが表示されていれば完璧です！！

<img width="545" alt="スクリーンショット 2020-01-03 1.56.19.png" src="https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/251768/dde09b86-9680-b992-f0fc-409e0f484d94.png">




## 新規登録をしたらFirebase Authenticationに登録されるようにする
https://firebase.google.com/docs/auth/web/password-auth?hl=ja
firebase SDKが提供してくれている

```javascript
firebase.auth().createUserWithEmailAndPassword
```

を使います。


pagesディレクトリ配下にsignup.vueというファイルを作成します。

```pages/signup.vue
<template>
  <v-row>
    <v-col cols="12" md="4">
      <h2>Sign Up</h2>
      <form>
        <v-text-field
          v-model="name"
          :counter="10"
          label="Name"
          data-vv-name="name"
          required
        ></v-text-field>
        <v-text-field
          v-model="email"
          :counter="20"
          label="Email"
          data-vv-name="email"
          required
        ></v-text-field>
        <v-text-field
          v-model="password"
          label="password"
          data-vv-name="password"
          required
          :type="show1 ? 'text' : 'password'"
          :append-icon="show1 ? 'mdi-eye' : 'mdi-eye-off'"
          @click:append="show1 = !show1"
        ></v-text-field>
        <v-text-field
          v-model="passwordConfirm"
          label="passwordConfirm"
          data-vv-name="passwordConfirm"
          required
          :type="show2 ? 'text' : 'password'"
          :append-icon="show2 ? 'mdi-eye' : 'mdi-eye-off'"
          @click:append="show2 = !show2"
        ></v-text-field>
        <v-btn class="mr-4" @click="signup">submit</v-btn>
        <p v-if="error" class="errors">{{ error }}</p>
      </form>
    </v-col>
  </v-row>
</template>
<script>
import firebase from "@/plugins/firebase";
export default {
  data() {
    return {
      email: "",
      name: "",
      password: "",
      passwordConfirm: "",
      show1: false,
      show2: false,
      error: "",
    };
  },
  methods: {
    async signup() {
      if (this.password !== this.passwordConfirm) {
        this.error = "※パスワードとパスワード確認が一致していません";
      }

      const res = await firebase
        .auth()
        .createUserWithEmailAndPassword(this.email, this.password)
        .catch((error) => {
          this.error = ((code) => {
            switch (code) {
              case "auth/email-already-in-use":
                return "既にそのメールアドレスは使われています";
              case "auth/wrong-password":
                return "※パスワードが正しくありません";
              case "auth/weak-password":
                return "※パスワードは最低6文字以上にしてください";
              default:
                return "※メールアドレスとパスワードをご確認ください";
            }
          })(error.code);
        });
    },
  },
};
</script>

<style scoped>
.errors {
  color: red;
  margin-top: 20px;
}
</style>
```


試しにユーザーを新規登録してみます。

<img width="1107" alt="スクリーンショット 2020-01-03 4.39.41.png" src="https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/251768/08dfef65-89b6-3bf7-a816-4e33286dadec.png">


FirebaseのConsoleで正しくユーザーが登録されていることを確認しましょう。
<img width="1386" alt="スクリーンショット 2020-01-03 4.37.50.png" src="https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/251768/e989b7d0-43fc-42f4-7c56-22da5cd47f7c.png">


## Rails側にも登録する
axiosを使ってPOSTメソッドでRailsのAPIを叩いてDBにも保存していきます。

## axiosのデフォルト設定
その前にaxiosのデフォルト設定をしていきます。
pluginsディレクトリにaxios.jsを作成します。


```plugins/axios.js
import axios from "axios";

export default axios.create({
    baseURL: process.env.API_ENDPOINT
})

```
環境変数API_ENDPOINTを.envに追加

```/.env
//省略
API_ENDPOINT="http://localhost:3000" // <= 追加
```

nuxt.config.jsが関連してくるファイルを編集したのでサーバーを立ち上げ直します。

```terminal
web $ npm run dev
```

これで**axios**の設定はokです。
上のような記述をすることで

```javascript

 axios.post("http::/localhost:3000/v1/users", newUser)
```
が以下のように書けます。

```javascript

 axios.post("/v1/users", newUser)
```

このようにすることでAPI側がデプロイ後にlocalhostから本番のurlが変わっても
.envに記載の環境変数の値を変更するだけで良くなります。


## signup.vueの修正

```javascript:pages/signup.vue
<script>
import axios from "@/plugins/axios" //追加

//省略

  // ↓追加
  const user = {
    email: res.user.email,
    name: this.name,
    uid: res.user.uid,
  };
  await axios.post("/v1/users", { user }).catch((err) => {
    console.log({ err });
  });
  this.$router.push("/");
```
上記のように修正してもう一度新規登録をしてみます。
すると以下のようなエラーが起きるはずです。

<img width="1264" alt="スクリーンショット 2020-01-03 5.08.54.png" src="https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/251768/e36ded79-b858-8a91-19c2-cb9057d8e32b.png">

これはまだRailsのAPI側で**CORS**の設定をしていないからです。Railsはデフォルトで異なるオリジンからのリクエストをセキュリティ保護のために拒否します。なのでlocalhost:8080(Nuxtのオリジン）からのリクエストのみ許可してあげる必要があります。

# CORSによる通信
RailsでCORSを許可するためのライブラリである**rack-corsと**いうGemを入れます。

```Gemfile.rb
# gem 'rack-cors' <= こいつをアンコメントします。
gem 'rack-cors'
```

```terminal
api $ bundle install
```

rails new --apiした段階でconfig/initializers/cors.rbというファイルが作成されているはずなので、これを編集していきます。

```config/initializers/cors.rb
# Be sure to restart your server when you modify this file.

# Avoid CORS issues when API is called from the frontend app.
# Handle Cross-Origin Resource Sharing (CORS) in order to accept cross-origin AJAX requests.

# Read more: https://github.com/cyu/rack-cors

# Rails.application.config.middleware.insert_before 0, Rack::Cors do
#   allow do
#     origins 'example.com'
#
#     resource '*',
#       headers: :any,
#       methods: [:get, :post, :put, :patch, :delete, :options, :head]
#   end
# end
```

これをこう！

```config/initializers/cors.rb

Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins '*' ## <= 修正。* でフルオープンにする。

    resource '*',
      headers: :any,
      methods: [:get, :post, :put, :patch, :delete, :options, :head]
  end
end

```
originsという箇所をアスタリスクに変更して、あらゆるリクエストを許可してあげます。
本来なら*で全許可するのは良くないですが、一旦これで進みます。
もう一度新規登録をしてみるとRails側のログがちゃんと走り、上手くDBに保存されるはずです。

<img width="773" alt="スクリーンショット 2020-01-03 5.31.12.png" src="https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/251768/e311aff4-9c3e-7af9-3139-939b0be4b068.png">


送られてくるparameterはこんな感じになってるはずです。

```
 Parameters: {"user"=>{"email"=>"qiita@gmail.com", "name"=>"qiita", "uid"=>"DZvDfuxQZCVZKelGwsAqxNtLeFf2"}}
```
ここで上手くuserというキーでラップされているのは

```javascript

 axios.post("/v1/users", { user })
```
{ user }で送っているのがポイントで、普通にuserで渡すとparameterのトップ階層にもemailなどが来てしまいます。
以下の画像のように変数を{}で囲むとその変数名がキーになって新しいオブジェクトを生成してくれるので
それを上手く使ってます。
<img width="589" alt="スクリーンショット 2020-01-03 5.36.09.png" src="https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/251768/3a1c7efd-3d82-952f-7e7c-29a20bb80e5a.png">



# ログイン状態の保持
普段Railsでアプリケーションを作ってる人はdeviseが提供してくれるヘルパーメソッドであるcurrent_userを良く使うと思います。
Nuxtでもcurrent_userのように今ログインしているユーザーの情報をどのページからでも呼び出せるようにしたいです。
Firebaseで今ログインしているユーザーの情報を呼び出すには
[firebase.auth().onAuthStateChanged](https://firebase.google.com/docs/auth/web/start?hl=ja#set_an_authentication_state_observer_and_get_user_data)を使います。
また、今回ログイン状態はVuexに保持させます。


pluginsディレクトリ配下にauthCheck.jsという新しいファイルを作成します。

```plugins/authCheck.js
import firebase from "@/plugins/firebase";
import axios from "@/plugins/axios";

const authCheck = ({ store, redirect }) => {
  firebase.auth().onAuthStateChanged(async user => {
    if (user) {
      const { data } = await axios.get('/v1/users', {
        params: {
          uid: user.uid,
        },
      });
      console.log("ログインしているユーザー:", data);
    };
  });
};

export default authCheck;

```

ただ難しいのがVuexのstoreは**props**と同様に**リロードすると壊れます**
他にも[vuex-persistedstate](https://github.com/robinvdvleuten/vuex-persistedstate)というライブラリとsessionStorageを併用するというやり方がありますが、
今回はnuxtのライフサイクルを上手く利用して保持するやり方でいきます。

先ほど作成したファイルをnuxt.config.jsの**plugins**という項目に追加すると
リロードする度に毎回呼んでくれます。(**plugins**はコンポーネントの描画よりもずっと前に呼ばれます）

```nuxt.config.js
  plugins: [
    "@/plugins/vuetify",
    "@/plugins/authCheck"
  ],
```
nuxt.config.jsを修正したのでサーバを立ち上げ直します。

```terminal
web$ npm run dev
```


firebase.auth().onAuthStateChangedで読み込める情報はユーザーのemail,displayName, profileImg,uidなので、uidで検索をかけれるようにrailsのapi側を修正していきます。


```v1/users_controller.rb
  def index
    @users = if params[:uid] 
               User.find_by(uid: params[:uid])
             else 
               User.all // 今後使わないので削除してもOK
             end

    render json: @users
  end
```

以下のようにconsoleにログインユーザーが表示されればokです！

<img width="1038" alt="スクリーンショット 2020-01-03 6.00.31.png" src="https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/251768/956678b9-aadc-4fc6-8f72-b6ec4ad12675.png">



## Vuexで管理
さて、これを全てのコンポーネントから自由自在に呼び出せるようにするために
Vuexを使っていきます。

storeディレクトリの中にauth.jsというファイルを作成します。


```store/auth.js
export const state = () => ({
  currentUser: null
});

export const mutations = {
  setUser(state, payload) {
    state.currentUser = payload
  },
};

export const actions = {};
```


authCheckプラグインでvuexのstoreに入れるようにします。

```plugins/authCheck.js
import firebase from "@/plugins/firebase";
import axios from "@/plugins/axios";

const authCheck = ({ store, redirect }) => {
  firebase.auth().onAuthStateChanged(async user => {
    if (user) {
      const { data } = await axios.get('/v1/users', {
        params: {
          uid: user.uid,
        },
      });
      store.commit("auth/setUser", data)
    } else {
      store.commit("auth/setUser", null)
    }
  });
};

export default authCheck;
```
このようにstoreのstateにRailsから受け取ったデータが入っていれば完璧です。
リロードしても同じ値が入っていることを確認してください。

<img width="567" alt="スクリーンショット 2020-01-03 6.07.04.png" src="https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/251768/257cb58b-7beb-89d1-aafa-f7a87f5f0f29.png">




## コンポーネント内でログインユーザーを呼び出す。

ストアにある状態をコンポーネント内で引き出すには**算出プロパティ**で返すことです。
と[vuexの公式](https://vuex.vuejs.org/ja/guide/state.html)が言っているので、それに従います。

```javascript

computed: {
  user(){
    return this.$store.state.currentUser
  }
}
```
これでtemplate内では”user",script内では"this.user"で呼び出せるようになりました。




試しにログインしているユーザーの名前を表示してみます。


```pages/index.vue
<template>
  <div>
    <p>{{user.name}}</p> //<- 追加
    <AddTodo @submit="addTodo" />
    <TodoList :todos="todos" />
  </div>
</template>

<script>
import AddTodo from "@/components/AddTodo";
import TodoList from "@/components/TodoList";

export default {
  components: {
    AddTodo,
    TodoList
  },
  computed: {  //<- 追加
    user() {
      return this.$store.state.auth.currentUser;
    }
  },
  data() {
    return {
      todos: []
    };
  },
  methods: {
    addTodo(title) {
      this.todos.push({
        title
      });
    }
  }
};
</script>

<style>
</style>

```


”Cannot read property 'name' of null"というエラーがコンソールに出てると思います。
これはfirebaseにログインしているユーザー情報を取りに行って、その後にrails側にリクエストを投げているので、storeにデータが入る前にコンポーネントが描画されているからです。

これに関してはおそらく多くの人がぶち当たる問題だと思います。いくつか解決方法はあるのですが、ここで解説すると長くなってしまうのでv-ifでいきます。
(1.nameプロパティを予め用意しておく、2.v-if 3. $store.watch 4. 初期描画画面を作る)

v-ifを使えばstoreのuserがセットされたら、v-ifで囲っている部分が描画されるようになるので、
nameと書いている箇所でエラーが起きることは無くなります。

```pages/index.vue
<template>
  <div v-if="user">
    <p>{{user.name}}</p>
    <AddTodo @submit="addTodo" />
    <TodoList :todos="todos" />
  </div>
</template>

<script>
import AddTodo from "@/components/AddTodo";
import TodoList from "@/components/TodoList";

export default {
  components: {
    AddTodo,
    TodoList
  },
  computed: {
    user() {
      return this.$store.state.auth.currentUser;
    }
  },
  data() {
    return {
      todos: []
    };
  },
  methods: {
    addTodo(title) {
      this.todos.push({
        title
      });
    }
  }
};
</script>

<style>
</style>
```


##  ログインページの作成

ログインには

```javascript
firebase.auth().signInWithEmailAndPassword
```

を使います。

```pages/login.vue
<template>
  <v-row>
    <v-col cols="12" md="4">
      <h2>Login</h2>
      <form>
        <v-text-field
          v-model="email"
          :counter="20"
          label="email"
          data-vv-name="email"
          required
        ></v-text-field>
        <v-text-field
          v-model="password"
          label="password"
          data-vv-name="password"
          required
          :type="show1 ? 'text' : 'password'"
          :append-icon="show1 ? 'mdi-eye' : 'mdi-eye-off'"
          @click:append="show1 = !show1"
        ></v-text-field>
        <v-btn class="mr-4" @click="login">submit</v-btn>
        <p v-if="error" class="errors">{{ error }}</p>
      </form>
    </v-col>
  </v-row>
</template>

<script>
import firebase from "@/plugins/firebase";
export default {
  data() {
    return {
      email: "",
      password: "",
      show1: false,
      error: "",
    };
  },
  methods: {
    async login() {
      await firebase
        .auth()
        .signInWithEmailAndPassword(this.email, this.password)
        .catch((error) => {
          console.log(error);
          this.error = ((code) => {
            switch (code) {
              case "auth/user-not-found":
                return "メールアドレスが間違っています";
              case "auth/wrong-password":
                return "※パスワードが正しくありません";
              default:
                return "※メールアドレスとパスワードをご確認ください";
            }
          })(error.code);
        });

      this.$router.push("/");
    },
  },
};
</script>

<style scoped>
.errors {
  color: red;
  margin-top: 20px;
}
</style>
```

## マイページの作成

の前にページ数が増えてきたのでナビゲーションバーのメニューリストを変えておきましょう。

```layouts/defaut.vue
<template>
  <v-app dark>
    <v-navigation-drawer v-model="drawer" :mini-variant="miniVariant" :clipped="clipped" fixed app>
      <v-list>
        <v-list-item v-for="(item, i) in items" :key="i" :to="item.to" router exact>
          <v-list-item-action>
            <v-icon>{{ item.icon }}</v-icon>
          </v-list-item-action>
          <v-list-item-content>
            <v-list-item-title v-text="item.title" />
          </v-list-item-content>
        </v-list-item>
      </v-list>
    </v-navigation-drawer>
    <v-app-bar :clipped-left="clipped" fixed app>
      <v-app-bar-nav-icon @click.stop="drawer = !drawer" />
      <v-btn icon @click.stop="miniVariant = !miniVariant">
        <v-icon>mdi-{{ `chevron-${miniVariant ? 'right' : 'left'}` }}</v-icon>
      </v-btn>
      <v-btn icon @click.stop="clipped = !clipped">
        <v-icon>mdi-application</v-icon>
      </v-btn>
      <v-btn icon @click.stop="fixed = !fixed">
        <v-icon>mdi-minus</v-icon>
      </v-btn>
      <v-toolbar-title v-text="title" />
      <v-spacer />
      <v-btn icon @click.stop="rightDrawer = !rightDrawer">
        <v-icon>mdi-menu</v-icon>
      </v-btn>
    </v-app-bar>
    <v-content>
      <v-container>
        <nuxt />
      </v-container>
    </v-content>
    <v-navigation-drawer v-model="rightDrawer" :right="right" temporary fixed>
      <v-list>
        <v-list-item @click.native="right = !right">
          <v-list-item-action>
            <v-icon light>mdi-repeat</v-icon>
          </v-list-item-action>
          <v-list-item-title>Switch drawer (click me)</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-navigation-drawer>
    <v-footer :fixed="fixed" app>
      <span>&copy; 2019</span>
    </v-footer>
  </v-app>
</template>

<script>
export default {
  data() {
    return {
      clipped: false,
      drawer: false,
      fixed: false,
      items: [
        {
          icon: "mdi-apps",
          title: "Todos", //追加
          to: "/"　//追加
        },
        {
          icon: "mdi-chart-bubble",
          title: "mypage", //追加
          to: "/mypage"  //追加
        }
      ],
      miniVariant: false,
      right: true,
      rightDrawer: false,
      title: "Todo App" //追加
    };
  },
};
</script>
```


## マイページの作成

マイページにはアカウント情報とログアウトボタンを配置します。
[Firebaseのsignout](https://firebase.google.com/docs/auth/web/password-auth?hl=ja)
には

```javascript

firebase.auth().signOut()
```
を使います。

pages/mypage.vueを作成します。

```pages/mypage.vue
<template>
  <div>
    <div v-if="user">
      <p>Email: {{ user.email }}</p>
      <p>ユーザー名: {{ user.name }}</p>
    </div>
    <v-btn @click="logOut">ログアウト</v-btn>
  </div>
</template>

<script>
import firebase from "@/plugins/firebase";
export default {
  computed: {
    user() {
      return this.$store.state.auth.currentUser;
    },
  },
  methods: {
    async logOut() {
      await firebase
        .auth()
        .signOut()
        .catch((error) => {
          console.log(error);
        });

      this.$store.commit("setUser", null);
      this.$router.push("/login");
    },
  },
};
</script>

<style>
</style>
```


## ナビゲーションバーのメニューリストの条件分岐
ログインしているかしていないかでメニューリストを条件分岐します。

```javascript:layouts/default.vue
 items: [
        {
          icon: "mdi-apps",
          title: "Todos",
          to: "/"
        },
        {
          icon: "mdi-chart-bubble",
          title: "mypage",
          to: "/mypage"
        }
      ],
```

上のdataのとこに入れているitemsプロパティを削除して
新しく算出プロパティを作ります。


```javascript:layouts/default.vue
computed: {
    user() {
      return this.$store.state.auth.currentUser;
    },
    items() {
      if (this.user) {
        return [
          {
            icon: "mdi-apps",
            title: "Todos",
            to: "/"
          },
          {
            icon: "mdi-chart-bubble",
            title: "mypage",
            to: "/mypage"
          }
        ];
      } else {
        return [
          {
            icon: "mdi-apps",
            title: "ログイン",
            to: "/login"
          },
          {
            icon: "mdi-chart-bubble",
            title: "新規登録",
            to: "/signup"
          }
        ];
      }
    }
}

```

ここまででログインしている状態とログアウトしている状態で
ナビゲーションバーのitemsが変わっていることを確認できたらokです。


## RailsのAPIを叩くところの修正


AddTodoコンポーネントで先ほどtitleのみを$emitで親コンポーネントに渡していましたが、
user_idも含めたオブジェクトとして送るように変更します。

```components/AddTodo.vue
<template>
  <v-form>
    <v-container>
      <v-row>
        <v-col cols="12" md="4">
          <v-text-field
            v-model="title"
            :counter="10"
            label="todo"
            required
          ></v-text-field>
        </v-col>
        <v-col cols="12" md="4">
          <v-btn @click="handleSubmit">作成</v-btn>
        </v-col>
      </v-row>
    </v-container>
  </v-form>
</template>
<script>
export default {
  data() {
    return {
      title: "",
    };
  },
  computed: {
    user() {
      return this.$store.state.auth.currentUser;
    },
  },
 methods: {
    handleSubmit() {
      const todo = {
        title: this.title,
        user_id: this.user.id, // 追加
      };
      this.$emit("submit", todo); 
      this.title = "";
    }
  }
};
</script>

<style>
</style>
```


```pages/index.vue
<template>
  <div v-if="user">
    <p>{{user.name}}</p>
    <AddTodo @submit="addTodo" />
    <TodoList :todos="user.todos" /> //修正
  </div>
</template>

<script>
import AddTodo from "@/components/AddTodo";
import TodoList from "@/components/TodoList";
import axios from "@/plugins/axios";
export default {
  components: {
    AddTodo,
    TodoList
  },
  computed: {
    user() {
      return this.$store.state.auth.currentUser;
    }
  },
  methods: {
    async addTodo(todo) {
      const { data } = await axios.post("/v1/todos", { todo });
      //追加
      this.$store.commit("auth/setUser", {
        ...this.user,
        todos: [...this.user.todos, data] 
      });
    }
  }
};
</script>

<style>
</style>
```


## Todo削除機能の追加

deleteItemというメソッドを追加し、引数でクリックしたitem(todo)を渡して、axios.deleteでAPIを叩きにいきます。

```components/TodoList.vue
  <template>
    <v-card>
      <v-card-title>
        Todo List
        <v-spacer></v-spacer>
        <v-text-field
          v-model="search"
          append-icon="search"
          label="Search"
          single-line
          hide-details
        ></v-text-field>
      </v-card-title>
      <v-data-table :headers="headers" :items="todos" :search="search">
        <template v-slot:item.action="{ item }">
          <v-icon small @click="deleteItem(item)">delete</v-icon>
        </template>
      </v-data-table>
    </v-card>
</template>

<script>
import axios from "@/plugins/axios";
export default {
  props: ["todos"],
  data() {
    return {
      singleSelect: true,
      selected: [],
      search: "",
      headers: [
        {
          text: "タイトル",
          align: "left",
          sortable: false,
          value: "title",
        },
        { text: "ユーザー名", value: "username" },
        { text: "Actions", value: "action", sortable: false },
      ],
    };
  },
  computed: {
    user() {
      return this.$store.state.auth.currentUser;
    },
  },
  methods: {
    async deleteItem(item) {
      const res = confirm("本当に削除しますか？");
      if (res) {
        await axios.delete(`/v1/todos/${item.id}`);
        const todos = this.user.todos.filter((todo) => {
          return todo.id !== item.id;
        });
        const newUser = {
          ...this.user,
          todos,
        };
        this.$store.commit("auth/setUser", newUser);
      }
    },
  },
};
</script>

<style>
</style>
```





＃# 現状の問題点

現状、新規登録をするとナビゲーションバーが変わっていないと思います。
これはPOSTが完了する前にGETでユーザーを取得しに行ってしまっていることが原因です。

<img width="626" alt="スクリーンショット 2020-01-04 1.27.40.png" src="https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/251768/c43457ac-df66-6f4d-6109-3432bbee0f41.png">

また、今のままでは新規登録があまりにもあっさりしすぎていることもあり、
ローディングさせてPOSTが終わるのを待たせるようにしたいと思います。



# Loadingコンポーネントの作成


ローディングのアニメーションを作るのに[loaders.css](https://connoratherton.com/loaders)というライブラリを使います。


```
web $ npm install loaders.css
```

```javascript:components/Loading.vue
<template>
  <div class="loader-container">
    <div class="loaders">
      <div class="ball-clip-rotate">
        <div class="ball"></div>
      </div>
    </div>
  </div>
</template>

<script>
import "loaders.css";
export default {
};
</script>

<style  lang="scss" scoped>
$theme-color: #25b290;
.loader-container {
  position: fixed;
  top: 0;
  z-index: 999;
  width: 100%;
  height: 100vh;
  background: #eee;
  opacity: 0.7;
}

.ball-clip-rotate > div {
  border: 2px solid $theme-color;
  /* background-color: orange !important; */
  border-bottom-color: transparent !important;
}

.ball-clip-rotate {
  position: absolute;
  top: 50%;
  color: red;
  transform: translate(-50%, -50%);
  left: 50%;
}
</style>

```



どんな感じにローディングが起きるかdefault.vueで試しに表示してみます。

```javascript:layouts/default.vue
<template>
  <v-app dark>
    <div>
      <Loading></Loading>　　//　追加
    </div>
　　//省略
</template>

<script>
import Loading from "@/components/Loading";　//追加
export default {
 　// 省略
  components: {
    Loading　　//追加
  },
　//　省略
};
</script>

```


下の画像のようにローディングされていればokです。

<img width="1432" alt="スクリーンショット 2020-01-04 1.36.58.png" src="https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/251768/d2719cfb-39cf-bdb9-ffa6-d1d3d3d4d40c.png">



では、新規登録の時だけこのローディングを呼び込むようにstoreで状態を保持するようにしましょう。
新しくローディング状態を管理するモジュールが必要になったので
store/loading.jsというファイルを作成します。


```store/loading.js
export const state = () => ({
  isLoading: false
});

export const mutations = {
  setLoading(state, payload) {
    state.isLoading = payload
  }
};

export const actions = {};
```



POSTが完了するまで待つのではなく、今回はsignupの時だけPOSTのpromiseで返ってきた値をそのままvuexのstoreにぶち込みます。

```javascript:pages/signup.vue
 methods: {
    async signup() {
      if (this.password !== this.passwordConfirm) {
        this.error = "※パスワードとパスワード確認が一致していません";
        return;
      }
      this.$store.commit("loading/setLoading", true); 
      const res = await firebase
        .auth()
        .createUserWithEmailAndPassword(this.email, this.password)
        .catch((error) => {
          this.error = ((code) => {
            switch (code) {
              case "auth/email-already-in-use":
                return "既にそのメールアドレスは使われています";
              case "auth/wrong-password":
                return "※パスワードが正しくありません";
              case "auth/weak-password":
                return "※パスワードは最低6文字以上にしてください";
              default:
                return "※メールアドレスとパスワードをご確認ください";
            }
          })(error.code);
        });

      const user = {
        email: res.user.email,
        name: this.name,
        uid: res.user.uid,
      };
      const { data } = await axios.post("/v1/users", { user }).catch((err) => {
        console.log({ err });
      });

      this.$store.commit("loading/setLoading", false); 
      this.$store.commit("auth/setUser", data);
      this.$router.push("/");
    },
  },
```



```components/Loading.vue
<template>
  <div class="loader-container" v-if="loading"> // v-ifで条件分岐
    <div class="loaders">
      <div class="ball-clip-rotate">
        <div class="ball"></div>
      </div>
    </div>
  </div>
</template>

<script>
import "loaders.css";
export default {
  computed: {
    loading() {
      return this.$store.state.loading.isLoading;　//storeから読み込む
    }
  }
};
</script>
```
これでvuexのloadingステートがtrueの時だけくるくるローディングが起こるようになります。
SPAはサクサク動くのがメリットではありますが、例えば決済や画像認識など、処理が早すぎるとユーザーが不安になるケースもあります。
時にはあえてローディングを差し込んであげることがUXの面では大切です。


# Successコンポーネントの作成
新規登録後やログイン後にポップアップでサクセスメッセージを表示するようにしてみましょう！

まずはサクセスメッセージをstoreで管理したいと思うのでnotificationというモジュールを追加しましょう。


```store/notification.js
export const state = () => ({
  message: "",
});

export const mutations = {
  setLoading(state, payload) {
    state.message = payload
  }
};

export const actions = {};
```



Successメッセージを表示するコンポーネントを作成します。
```components/messages/Success.vue

<template>
  <transition name="fade">
    <div v-if="notice.message" class="success">{{notice.message}}</div>
  </transition>
</template>


<script>
export default {
  computed: {
    notice() {
      return this.$store.state.notification;
    }
  }
};
</script>

<style scoped>
.success {
  position: fixed;
  top: 0;
  z-index: 50;
  text-align: center;
  line-height: 56px;
  width: 100%;
  background: rgb(193, 245, 193);
  color: #fff;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s;
}
.fade-enter, .fade-leave-to /* .fade-leave-active below version 2.1.8 */ {
  opacity: 0;
}
</style>

```



作成したSuccessコンポーネントをdefault.vueに入れ込みます。


```layouts/default.vue
<template>
  <v-app dark>
    <Success /> //追加
    <Loading /> 

<script>
import Loading from "@/components/Loading";
import Success from "@/components/messages/Success" //追加
export default {
  //省略
  components: {
    Loading,
    Success  //追加
  },
}
```

試しに[Vue-devtools](https://chrome.google.com/webstore/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd?hl=ja)でstateの値を変更してみます

<img width="619" alt="スクリーンショット 2020-01-04 3.25.44.png" src="https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/251768/e3ff1393-4aa5-bc9e-470c-50deb06c7db3.png">


すると下の画像のように上手くサクセスメッセージが表示されていると思います。



<img width="1431" alt="スクリーンショット 2020-01-04 3.28.40.png" src="https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/251768/42ce5967-03b2-b79e-57ba-bde2ca14075b.png">



試しにlogin時にサクセスメッセージを表示してみましょう。

```javascript:pages/login.vue

login() {
      firebase
        .auth()
        .signInWithEmailAndPassword(this.email, this.password)
        .then(() => {
          this.$store.commit("setNotice", {
            status: true,
            message: "ログインしました"
          });
          setTimeout(() => {
            this.$store.commit("setNotice",{});
          }, 2000); //2秒後に隠す
          this.$router.push("/");
        })
```

これで新規登録時、ログアウト時、Todo作成時にもmessageの値を変えて$store.commit("setNotice")をするだけでサクセスメッセージが呼び込めるようになりました



# ナビゲーションガードの実装
railsのdeviseで言うところのauthenticate_user!的なやつです。
現状、ログインしていないユーザーでもトップページやマイページを見れてしまいます。
ログインしていないユーザーはログイン画面にリダイレクトさせるようにします。

Vue.jsに慣れている人なら**router.beforeEach**なんかを思いつくと思いますが、
今回はstoreの値を元に条件分岐してナビゲーションガードさせたいのでNuxtのライフサイクルである**fetch**もしくは**middleware**を使います。



storeのcurrentUserというキーを[$store.watch](https://vuex.vuejs.org/ja/api/#watch)で監視します。firebase.auth().onAuthStateChanged()でcurrentUserの値が書き換わると$store.watchが発火します。
変更後のcurrentUserの値がnullであれば(つまりログインしていなければ)、redirect("/login")するという感じです。

＊fetchを使う場合

```javascript:pages/index.vue
fetch({ store, redirect }) {
    store.watch(
      state => state.auth.currentUser,
      (newUser, oldUser) => {
        if (!newUser) {
          return redirect("/login");
        }
      }
    );
  },
```


＊middlewareを使う場合

```middleware/routerGuard.js
export default function ({
    store,
    redirect,
    route,

}) {
    store.watch(
        state => state.auth.currentUser,
        (newUser, oldUser) => {
            if (!newUser) {
                switch (route.name) {
                    case "index":
                        redirect("/login")
                    case "mypage":
                        redirect("/login")
                    default:
                        return;
                }
            }
        }
    );
}
```


```nuxt.config.js
export default {
  mode: 'spa',
  router: { //追加
    middleware: ['routerGuard']
  },
```

例によってサーバを立ち上げ直します

```terminal
web $ npm run dev
```

どちらを使うべきかですが、middlewareを仕込むとrouteが毎回変わる度にコードが走るのでfetchの方が良いと思います。

middlewareの用途ですが、詳細ページでリロードされた時に前のページに強制リダイレクトさせるためにmiddlewareを使います。
(一覧ページからpropsでデータを受け取って表示していると、リロードされたときにpropsが消えてしまうので）


ただ現状、currentUserの初期値がnullになっているので
authStateChangedの条件分岐でstore.commit("setUser", null)としても、変更されたと認識できず$store.watchが発火せず、
リダイレクトされません。

以下のように初期値を修正します。


```store/auth.js
export const state = () => ({
  currentUser: {}
});

// 省略
```

これにより初期値{}からnullに変更され$store.watchが発火するようになります。

ここまでで、非ログイン時にマイページやトップページに行ってリダイレクトされることを確認してください。
（同じようにloginページとsignupページにもログインしていたらマイページにリダイレクトさせる処理を書いておくと良いでしょう。）


## Vuexのリファクタリング

今まではsignupやloginなどページコンポーネントの中でAPIを叩く処理を書いていました。
これをactionsに移行します。
その前にせっかくなのでstateとmutationsとactionsそれぞれ別ファイルに分割しときます。



```store/auth.js
import firebase from "@/plugins/firebase";
export const state = () => ({
  currentUser: {}
});

export const mutations = {
  setUser(state, payload) {
    state.currentUser = payload
  },
};

export const actions = {
  async login({
    commit,
  }, payload) {
    await firebase
      .auth()
      .signInWithEmailAndPassword(payload.email, payload.password)
      .catch((error) => {
        console.log(error);
        this.error = ((code) => {
          switch (code) {
            case "auth/user-not-found":
              return "メールアドレスが間違っています";
            case "auth/wrong-password":
              return "※パスワードが正しくありません";
            default:
              return "※メールアドレスとパスワードをご確認ください";
          }
        })(error.code);
      });

    commit("notification/setNotice", "ログインしました", { root: true });
    setTimeout(() => {
      commit("notification/setNotice", "", { root: true });
    }, 2000);

    this.$router.push("/");
  },
};
```

今回はauthモジュールの中でnotificationモジュールを呼び出そうとするので
{ root: true }を第3引数に渡すことでroot起点で呼び出せるようになります。


loginページコンポーネントではこのactionsを叩きに行きます。

```javascript:pages/login.vue
 methods: {
    login() {
      this.$store.dispatch("login", {
        email: this.email,
        password: this.password
      });
    }
  }
```

同じようにログアウトや新規登録の処理もactionsに移動させてみると良いでしょう。



# デプロイ
RailsのAPIは**Heroku**に(選択肢: EC2でもGAE)
Nuxtは**Firebase Hosting**に(選択肢: netlify, surge, now)

## Railsのデプロイ
https://qiita.com/kazukimatsumoto/items/a0daa7281a3948701c39
Herokuへのデプロイはこの記事を参考にさせていただきます。



```config/database.yml
production:
  <<: *default
  adapter: postgresql
  encoding: unicode
  pool: 5
```


sqlite3を開発・テスト環境のみに適用してpgを本番環境用に追加します。

```Gemfile
group :development, :test do
  gem 'sqlite3'
end

group :production do
  gem 'pg'
end
```

```
api $ bundle install --without production
api $ heroku create アプリ名
api $ git push heroku master 
api $ heroku run rails db:migrate
```
heroku openで/v1/usersにアクセスして空配列が表示されていればokです！




## Nuxtのデプロイ
デプロイ前に環境変数の設定を変更しておきます。


```.env
API_ENDPOINT="HerokuのURL"
```

デプロイはfirebase deployコマンドを使って行いますが、
firebase.jsonというファイルがまだないので作ります。

```terminal
web $ firebase init
```
このコマンドを打つとFIrebaseのロゴが出てきていくつか質問をされると思います。


<img width="977" alt="スクリーンショット 2020-01-05 7.01.12.png" src="https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/251768/224b6b7e-bf4e-9fe1-2974-58ff45f3b70f.png">
一旦Hostingのみを選択します。(スペースキーで選択の後Enter)

・Please select an option: Use an existing project

・Select a default Firebase project for this directory: qiita-todo
作成済みのFirebaseプロジェクトを選択します。

・ What do you want to use as your public directory? dist
ここではデフォルトでpublicとなっていますが、distと入力してenterを押します。

・ Configure as a single-page app (rewrite all urls to /index.html)? y
SPAなのでyesで

上手くいくとこんな感じに
<img width="681" alt="スクリーンショット 2020-01-05 7.06.41.png" src="https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/251768/e7b52b21-99db-4dd0-1ce1-03dd4c8ef178.png">



[Nuxt SPAモードのデプロイ](https://ja.nuxtjs.org/guide/commands/#%E3%82%B7%E3%83%B3%E3%82%B0%E3%83%AB%E3%83%9A%E3%83%BC%E3%82%B8%E3%82%A2%E3%83%97%E3%83%AA%E3%82%B1%E3%83%BC%E3%82%B7%E3%83%A7%E3%83%B3%E3%83%87%E3%83%97%E3%83%AD%E3%82%A4-spa-)は公式に従って行います。

```
web $ npm run build
```
このコマンドを打つとpackage.jsonのscripts.devのnuxtコマンドが呼ばれ
distディレクトリ配下にbuildされたファイルが格納されます。
先ほどfirebase initコマンドで質問された際にdistフォルダを指定したのはこのためです。

```
web $ firebase deploy
```
このコマンドは.firebasercを読み込み、**distフォルダ**を.firebaserc記載のプロジェクト宛にデプロイを開始します。

デプロイが完了すると以下のような感じになると思います。

<img width="675" alt="スクリーンショット 2020-01-05 7.09.08.png" src="https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/251768/16c028b8-991a-210a-161c-7346e011a27a.png">
あとはHosting URLで表示されているURLをブラウザで確認できれば完了です。


# CORS側の再設定
現状**rack-cors**の設定はフルオープンになってしまっているので、開発環境と本番環境で許容するオリジンを条件分岐しておくと良いでしょう。修正が完了したらgit commitしてgit push heroku masterで変更を反映させます。

```config/initializers/cors.rb
Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    ## origins '*' 
    if Rails.env.production?
        origins 'https://qiita-todo.firebaseapp.com' 
    else 
        origins 'http://localhost:3000'
    end
   
    resource '*',
      headers: :any,
      methods: [:get, :post, :put, :patch, :delete, :options, :head]
  end
end
```

## 補足
フロント側のコードを編集し、それを本番環境に反映させたい時は
**npm run build**と**firebase deploy**を繰り返すだけでokです。

※今のままでは開発環境と本番環境を行き来する度に、.env(環境変数)の値を毎回変えなくではならないので
[cross-env](https://github.com/kentcdodds/cross-env)というライブラリを使うと簡単に開発環境と本番環境で環境変数を使い分けるので便利です。


# 最後に
ここまででチュートリアルは終了です。
現状コンポーネントの分け方が雑なので、**atomic design**を導入してコンポーネントを整理してみると良いでしょう。
この記事でフロントエンドベースで開発を進めてバックエンドのAPIを叩きに行く一連の流れが理解していただけれいれば幸いです。また、他の技術での組み合わせも試してみたりすると面白いかもしれません。

※先輩エンジニアの方々、間違っているところやもっとこうすべきみたいなアドバイスがあれば指摘していただければ幸いです。
※わからない箇所はTwiiterでDMくれれば対応しますのでお気軽に！
筆者のアカウント => https://twitter.com/gigig826
