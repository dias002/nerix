import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import { installChunkErrorHandlers } from "./app/chunkError.ts";
import "./styles/index.css";

installChunkErrorHandlers();

createRoot(document.getElementById("root")!).render(<App />);
