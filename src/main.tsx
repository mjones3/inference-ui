import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
// import { Amplify } from "aws-amplify";

// Initialize AWS configuration
// const awsConfig = {
//   API: {
//     endpoints: [
//       {
//         name: "api",
//         endpoint: process.env.REACT_APP_API_URL || "/api",
//       },
//     ],
//   },
// };

// Amplify.configure(awsConfig);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
//
