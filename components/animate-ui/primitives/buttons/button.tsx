'use client';

import * as React from 'react';
import { motion, type HTMLMotionProps } from 'motion/react';

import { Slot, type WithAsChild } from '@/components/animate-ui/primitives/animate/slot';

type MotionButtonBase = Omit<HTMLMotionProps<'button'>, 'ref'>;

type ButtonProps = WithAsChild<
  MotionButtonBase & {
    hoverScale?: number;
    tapScale?: number;
  }
>;

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ hoverScale = 1.05, tapScale = 0.95, asChild = false, ...props }, ref) => {
    if (asChild) {
      return (
        <Slot
          ref={ref as React.Ref<HTMLButtonElement> | undefined}
          whileTap={{ scale: tapScale }}
          whileHover={{ scale: hoverScale }}
          {...props}
        />
      );
    }

    return (
      <motion.button
        ref={ref}
        whileTap={{ scale: tapScale }}
        whileHover={{ scale: hoverScale }}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button, type ButtonProps };
