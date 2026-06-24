import { Navigate, useLocation } from "react-router-dom";
import {
  legacyAgentBuilderPathToI420,
  legacyAutomationsPathToI420,
} from "@/lib/i420Routes";

export function LegacyAgentBuilderRedirect() {
  const { pathname } = useLocation();
  return <Navigate to={legacyAgentBuilderPathToI420(pathname)} replace />;
}

export function LegacyAutomationsRedirect() {
  const { pathname } = useLocation();
  return <Navigate to={legacyAutomationsPathToI420(pathname)} replace />;
}
