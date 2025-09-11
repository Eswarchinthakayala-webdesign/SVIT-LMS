import { Navigate } from "react-router-dom";

export default function StudentCheck({ children }) {
  const user = JSON.parse(localStorage.getItem("user")); // or use context/auth provider

  if (!user || user.role !== "student") {
    return <Navigate to="/login" replace />;
  }

  return children;
}
