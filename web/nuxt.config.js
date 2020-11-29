import colors from 'vuetify/es5/util/colors';
require('dotenv').config();
export default {
  server: {
    port: 8080
  },
  ssr: false,
  router: {
    middleware: ['routerGuard']
  },
  target: 'static',
  head: {
    titleTemplate: '%s - todoApp',
    title: 'todoApp',
    meta: [
      { charset: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { hid: 'description', name: 'description', content: '' }
    ],
    link: [
      { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }
    ]
  },
  css: [
  ],
  plugins: [
    "@/plugins/vuetify",
    "@/plugins/authCheck",
  ],
  components: true,
  buildModules: [
    '@nuxtjs/vuetify',
    '@nuxtjs/dotenv',
  ],
  modules: [
    '@nuxtjs/axios',
  ],
  axios: {},
  vuetify: {
    customVariables: ['~/assets/variables.scss'],
    theme: {
      dark: true,
      themes: {
        dark: {
          primary: colors.blue.darken2,
          accent: colors.grey.darken3,
          secondary: colors.amber.darken3,
          info: colors.teal.lighten1,
          warning: colors.amber.base,
          error: colors.deepOrange.accent4,
          success: colors.green.accent3
        }
      }
    }
  },
  build: {
  }
}
