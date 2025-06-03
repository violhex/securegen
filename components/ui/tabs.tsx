"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "bg-muted text-muted-foreground inline-flex h-9 w-fit items-center justify-center rounded-lg p-[3px]",
        className
      )}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  // Base layout and typography classes
  const baseClasses = [
    "inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5",
    "rounded-md border border-transparent px-2 py-1",
    "text-sm font-medium whitespace-nowrap"
  ].join(" ")

  // Color and theme classes
  const colorClasses = [
    "text-foreground dark:text-muted-foreground"
  ].join(" ")

  // Active state classes
  const activeStateClasses = [
    "data-[state=active]:bg-background data-[state=active]:shadow-sm",
    "dark:data-[state=active]:text-foreground dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30"
  ].join(" ")

  // Focus and interaction classes
  const focusClasses = [
    "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring",
    "focus-visible:ring-[3px] focus-visible:outline-1"
  ].join(" ")

  // Transition and disabled state classes
  const stateClasses = [
    "transition-[color,box-shadow]",
    "disabled:pointer-events-none disabled:opacity-50"
  ].join(" ")

  // SVG icon classes
  const iconClasses = [
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
  ].join(" ")

  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        baseClasses,
        colorClasses,
        activeStateClasses,
        focusClasses,
        stateClasses,
        iconClasses,
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
