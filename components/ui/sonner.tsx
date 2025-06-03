"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, ToasterProps } from "sonner"

// Type guard to validate theme values
const isValidSonnerTheme = (theme: string | undefined): theme is ToasterProps["theme"] => {
  return theme === "light" || theme === "dark" || theme === "system"
}

// Safe theme mapper with fallback
const getSafeTheme = (theme: string | undefined): ToasterProps["theme"] => {
  if (isValidSonnerTheme(theme)) {
    return theme
  }
  // Default to "system" for any invalid or undefined theme
  return "system"
}

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()
  const safeTheme = getSafeTheme(theme)

  return (
    <Sonner
      theme={safeTheme}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
