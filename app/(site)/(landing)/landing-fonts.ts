import localFont from "next/font/local";

export const stackSansMedium = localFont({
  src: "../../../public/fonts/Stack_Sans_Text/static/StackSansText-Medium.ttf",
  weight: "500",
  display: "swap",
  variable: "--font-stack-sans-medium",
});

export const stackSansExtraLight = localFont({
  src: "../../../public/fonts/Stack_Sans_Text/static/StackSansText-ExtraLight.ttf",
  weight: "200",
  display: "swap",
  variable: "--font-stack-sans-extralight",
});

export const stackSansLight = localFont({
  src: "../../../public/fonts/Stack_Sans_Text/static/StackSansText-Light.ttf",
  weight: "300",
  display: "swap",
  variable: "--font-stack-sans-light",
});

export const interLight = localFont({
  src: "../../../public/fonts/Inter/static/Inter_24pt-Light.ttf",
  weight: "300",
  display: "swap",
  variable: "--font-inter-light",
});
