"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner";

const Toaster = ({
  ...props
}) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme}
      // On phones sonner sets left: 16px plus width: 100%, which pushes the
      // toast 16px past the right edge. Pin both sides instead.
      className="toaster group max-[600px]:!w-auto max-[600px]:!left-4 max-[600px]:!right-4"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
          // Keep the toast inside the viewport on mobile so long
          // messages wrap instead of being cut off at the screen edge.
          "--width": "min(356px, calc(100vw - 2rem))",
        }
      }
      toastOptions={{
        classNames: {
          toast: "!w-full",
          title: "!whitespace-normal break-words",
          description: "!whitespace-normal break-words",
        },
      }}
      {...props} />
  );
}

export { Toaster }
