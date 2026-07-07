import React from "react";
import { SignIn } from "@clerk/nextjs";

// Custom-branded auth shell (see git history: AuthShell.tsx) will be
// rebuilt on top of Clerk Elements later; prebuilt component for now.
export default function LoginPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#080C14",
      }}
    >
      <SignIn routing="hash" signUpUrl="/signup" />
    </div>
  );
}
