import * as React from "react";
import { cn } from "@/lib/utils";

interface GradientTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  as?: keyof JSX.IntrinsicElements;
}

const GradientText = ({ as: Tag = "span", className, children, ...props }: GradientTextProps) => {
  const Component = Tag as any;
  return (
    <Component
      className={cn(
        "bg-clip-text text-transparent bg-gradient-to-r from-primary via-primary-glow to-accent",
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  );
};

export default GradientText;
