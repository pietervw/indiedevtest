import { SignIn } from "@clerk/nextjs";
import { AuthPageShell, authPageMetadata } from "@/components/auth-page-shell";

export const metadata = authPageMetadata("Sign in");

export default function SignInPage() {
  return (
    <AuthPageShell>
      <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />
    </AuthPageShell>
  );
}
