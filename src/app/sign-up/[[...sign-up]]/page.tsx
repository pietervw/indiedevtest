import { SignUp } from "@clerk/nextjs";
import { AuthPageShell, authPageMetadata } from "@/components/auth-page-shell";

export const metadata = authPageMetadata("Sign up");

export default function SignUpPage() {
  return (
    <AuthPageShell>
      <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
    </AuthPageShell>
  );
}
