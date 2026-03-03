// frontend/src/main.jsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import ErrorBoundary from "./ErrorBoundary.jsx";
import FormApp from "./form_app.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <FormApp />
    </ErrorBoundary>
  </StrictMode>
);
