"use client";

import RoleSelectionDialog from "@/components/RoleSelectionDialog.client";

type LandingGuestHeroCtaProps = {
  triggerClassName: string;
};

export default function LandingGuestHeroCta({
  triggerClassName,
}: LandingGuestHeroCtaProps) {
  return (
    <RoleSelectionDialog
      triggerLabel="Comenzar"
      triggerClassName={triggerClassName}
      triggerShowCircle
    />
  );
}
