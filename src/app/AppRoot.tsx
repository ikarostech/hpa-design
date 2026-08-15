import type { PropsWithChildren } from "react";
import { HashRouter } from "react-router-dom";
import App from "./App";

export function ApplicationRouter({ children }: PropsWithChildren) {
  return <HashRouter>{children}</HashRouter>;
}

export function AppRoot() {
  return <ApplicationRouter><App /></ApplicationRouter>;
}
