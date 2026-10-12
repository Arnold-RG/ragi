import "./styles/crt.css";
import { startApp } from "./app";

const root = document.getElementById("app");
if (!root) throw new Error("#app missing");
void startApp(root);
