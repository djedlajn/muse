import inquirer = require("inquirer");
import validator from "validator";

export const questions = () => {
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
    {
      name: "combine",
      type: "list",
      message: "Should I try and combine pdfs ?",
      choices: ["YES", "NO"],
      default: "NO",
    },
  ];
  return inquirer.prompt(questions);
};
