"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { openCreateRequestWizard } from "@/components/requests/CreateRequestWizardRoot";

type ButtonElement = React.ElementRef<typeof Button>;
type ButtonProps = React.ComponentPropsWithoutRef<typeof Button>;

export type CreateRequestButtonProps = Omit<ButtonProps, "onClick"> & {
  label?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
};

const CreateRequestButton = React.forwardRef<ButtonElement, CreateRequestButtonProps>(
  ({ label = "Crear solicitud", children, onClick, type = "button", asChild = false, ...props }, ref) => {
    const content = children ?? label;
    return (
      <Button
        ref={ref}
        asChild={asChild}
        type={asChild ? undefined : type}
        {...props}
        onClick={(event) => {
          onClick?.(event);
          if (event.defaultPrevented) return;
          openCreateRequestWizard();
        }}
      >
        {content}
      </Button>
    );
  },
);

CreateRequestButton.displayName = "CreateRequestButton";

export default CreateRequestButton;
