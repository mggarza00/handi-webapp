import Image from "next/image";
import localFont from "next/font/local";

import styles from "./PaymentProtectionBadge.module.css";

const interRegular = localFont({
  src: "../public/fonts/Inter/static/Inter_24pt-SemiBold.ttf",
  weight: "600",
  variable: "--font-inter-regular",
});

const interLight = localFont({
  src: "../public/fonts/Inter/static/Inter_24pt-Light.ttf",
  weight: "300",
  variable: "--font-inter-light",
});

const stars = Array.from({ length: 5 });

export default function PaymentProtectionBadge() {
  return (
    <div className={`${styles.paymentBadge} ${interRegular.className}`}>
      <div className={styles.paymentBadge__iconWrapper}>
        <Image src="/icons/candado_vo.png" alt="Candado" width={26} height={26} />
      </div>
      <div className={styles.paymentBadge__text}>
        <div>
          <p className={styles.paymentBadge__title}>Pagos</p>
          <p className={`${styles.paymentBadge__subtitle} ${interLight.className}`}>100% protegidos</p>
        </div>
        <div className={styles.paymentBadge__stars}>
          {stars.map((_, idx) => (
            <svg
              key={`payment-star-${idx}`}
              viewBox="0 0 24 24"
              className={styles.paymentBadge__star}
              aria-hidden="true"
            >
              <path d="M12 2l3 6 6.6.9-4.8 4.5 1.1 6.6L12 17.8 6.1 20l1.1-6.6L2.4 8.9 9 8z" />
            </svg>
          ))}
        </div>
      </div>
    </div>
  );
}
