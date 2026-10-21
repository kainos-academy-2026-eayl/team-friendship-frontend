const loginPage = {
  title: "E-commerce login",
  eyebrow: "Welcome back",
  intro: "Log in to your account to continue shopping.",
  fields: [
    {
      id: "username",
      name: "username",
      label: "Username",
      type: "text",
      autocomplete: "username",
      placeholder: "Enter your username",
    },
    {
      id: "password",
      name: "password",
      label: "Password",
      type: "password",
      autocomplete: "current-password",
      placeholder: "Enter your password",
    },
  ],
  forgotPassword: {
    id: "forgot-password",
    label: "Forgot password?",
  },
  actions: [
    {
      id: "login-submit",
      type: "submit",
      label: "Login",
      disabled: true,
    },
    {
      id: "sign-up",
      type: "button",
      label: "Sign up",
      className: "secondary",
    },
  ],
};

export default loginPage;
