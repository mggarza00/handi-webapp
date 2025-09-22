import { Nunito, Varela_Round, Concert_One } from "next/font/google";

export const nunito = Nunito({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-nunito",
  weight: ["200", "300", "400", "500", "600", "700", "800", "900"],
});

export const varelaRound = Varela_Round({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-varela",
  weight: "400",
});

export const concertOne = Concert_One({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-concert",
  weight: "400",
});
