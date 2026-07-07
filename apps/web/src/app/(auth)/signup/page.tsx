import React from "react";
import { SignUp } from "@clerk/nextjs";

export default function SignupPage() {
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
      <SignUp routing="hash" signInUrl="/login" forceRedirectUrl="/onboarding" />
    </div>
  );
}
