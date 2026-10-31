import { Toaster as Sonner, toast } from "sonner";
import { useDarkMode } from "@/hooks/useDarkMode";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { isDark } = useDarkMode();

  return (
    <Sonner
      theme={isDark ? "dark" : "light"}
      position="top-center"
      className="toaster group"
      toastOptions={{
        style: { pointerEvents: "auto" },
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
