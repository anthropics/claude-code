import { LoginForm } from '@/components/shared/LoginForm'

interface Props {
  searchParams: Promise<{ error?: string; next?: string }>
}

export default async function LoginPage({ searchParams }: Props) {
  const { error } = await searchParams
  const initialError =
    error === 'auth' ? 'O link de acesso expirou ou é inválido. Tente novamente.' : (error ?? null)
  return <LoginForm initialError={initialError} />
}
