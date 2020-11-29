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

