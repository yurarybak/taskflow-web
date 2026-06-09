import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { api } from "../../lib/api";
import { Button, Field, Input } from "../../components/ui";
import { useAuth } from "./auth-provider";

const loginSchema = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters"),
});
const registerSchema = loginSchema.extend({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});
type LoginFields = z.infer<typeof loginSchema>;
type RegisterFields = z.infer<typeof registerSchema>;

function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="brand">
          <span>TF</span>
          <strong>TaskFlow</strong>
        </div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
        {children}
      </section>
    </main>
  );
}
export function LoginPage() {
  const { user, login } = useAuth();
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFields>({ resolver: zodResolver(loginSchema) });
  if (user) return <Navigate to="/" replace />;
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to continue managing your team's work."
    >
      <form
        onSubmit={handleSubmit(async (values) => {
          try {
            setError("");
            await login(values);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Could not sign in");
          }
        })}
      >
        <Field label="Email" error={errors.email?.message}>
          <Input type="email" autoComplete="email" {...register("email")} />
        </Field>
        <Field label="Password" error={errors.password?.message}>
          <Input
            type="password"
            autoComplete="current-password"
            {...register("password")}
          />
        </Field>
        <Link className="auth-link right" to="/forgot-password">
          Forgot password?
        </Link>
        {error && <div className="form-error">{error}</div>}
        <Button loading={isSubmitting} type="submit">
          Sign in
        </Button>
      </form>
      <p className="auth-footer">
        New to TaskFlow? <Link to="/register">Create an account</Link>
      </p>
    </AuthShell>
  );
}
export function RegisterPage() {
  const { user, register: signup } = useAuth();
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFields>({ resolver: zodResolver(registerSchema) });
  if (user) return <Navigate to="/" replace />;
  return (
    <AuthShell
      title="Create your account"
      subtitle="Start organizing projects and tasks in one focused workspace."
    >
      <form
        onSubmit={handleSubmit(async (values) => {
          try {
            setError("");
            await signup(values);
          } catch (e) {
            setError(
              e instanceof Error ? e.message : "Could not create account",
            );
          }
        })}
      >
        <div className="form-grid">
          <Field label="First name">
            <Input {...register("firstName")} />
          </Field>
          <Field label="Last name">
            <Input {...register("lastName")} />
          </Field>
        </div>
        <Field label="Email" error={errors.email?.message}>
          <Input type="email" {...register("email")} />
        </Field>
        <Field label="Password" error={errors.password?.message}>
          <Input type="password" {...register("password")} />
        </Field>
        {error && <div className="form-error">{error}</div>}
        <Button loading={isSubmitting} type="submit">
          Create account
        </Button>
      </form>
      <p className="auth-footer">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </AuthShell>
  );
}
export function ForgotPage() {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<{ email: string }>();
  return (
    <AuthShell
      title="Reset your password"
      subtitle="We'll send instructions to your account email."
    >
      {sent ? (
        <div className="success">
          <CheckCircle2 />
          <h3>Check your inbox</h3>
          <p>If an account exists, reset instructions are on the way.</p>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit(async ({ email }) => {
            await api.forgot(email);
            setSent(true);
          })}
        >
          <Field label="Email">
            <Input type="email" required {...register("email")} />
          </Field>
          <Button loading={isSubmitting}>Send reset instructions</Button>
        </form>
      )}
      <Link className="auth-link back" to="/login">
        <ArrowLeft size={14} /> Back to sign in
      </Link>
    </AuthShell>
  );
}
export function ResetPage() {
  const [params] = useSearchParams();
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<{ newPassword: string }>();
  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Use at least eight characters for your new password."
    >
      {done ? (
        <div className="success">
          <CheckCircle2 />
          <h3>Password updated</h3>
          <Link to="/login">Continue to sign in</Link>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit(async ({ newPassword }) => {
            await api.reset({ token: params.get("token") || "", newPassword });
            setDone(true);
          })}
        >
          <Field label="New password">
            <Input
              type="password"
              minLength={8}
              required
              {...register("newPassword")}
            />
          </Field>
          <Button loading={isSubmitting}>Update password</Button>
        </form>
      )}
    </AuthShell>
  );
}
