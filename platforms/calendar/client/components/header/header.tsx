'use client'

import HeaderGithub from './header-github'
import { HeaderThemeToggle } from './header-theme-toggle'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'

export default function Header() {
  const { isAuthenticated, logout } = useAuth()
  return (
    <div className="flex items-center justify-between p-2 w-full border-b">
      <div>
        <h1 className="text-lg font-bold">
          React, Tailwind and Shadcn Full Calendar
        </h1>
        <h3 className="text-muted-foreground">
          By <span className="font-bold">@charlietlamb</span>
        </h3>
      </div>
      <div className="flex items-center gap-2">
        {isAuthenticated && (
          <Button variant="outline" size="sm" onClick={logout}>
            Sign out
          </Button>
        )}
        <HeaderGithub />
        <HeaderThemeToggle />
      </div>
    </div>
  )
}
