import inquirer = require("inquirer");
import validator from "validator";

export const askGithubCredentials = () => {
  const questions = [
    {
      name: "url",
      type: "input",
      message: "Enter book URL",
      validate: function (value: string) {
        if (value.length && validator.isURL(value)) {
          return true;
        } else {
          return "Please enter valid MUSE book URL";
        }
      },
    },
  ];
  return inquirer.prompt(questions);
};
