export const state = () => ({
  message: "",
});

export const mutations = {
  setNotice(state, payload) {
    state.message = payload
  }
};

export const actions = {};
