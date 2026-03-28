import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "var(--font-archivo)" }}>
            ARE Structural Calculators
          </h1>
          <p className="text-sm text-gray-500 mt-1">Anderson Rohr Engineering — Internal Tool</p>
        </div>
        <SignIn />
      </div>
    </div>
  );
}
