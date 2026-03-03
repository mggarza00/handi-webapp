import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

type PayoutReceiptData = {
  payoutId: string;
  createdAtISO: string;
  professionalName: string;
  professionalEmail: string;
  amount: number;
  currency: string;
  requestId?: string | null;
  agreementId?: string | null;
  transferId?: string | null;
};

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 11, fontFamily: "Helvetica" },
  title: { fontSize: 16, fontWeight: 700, marginBottom: 12 },
  section: { marginBottom: 12 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  label: { color: "#64748b" },
  value: { color: "#0f172a" },
  code: { fontFamily: "Courier", fontSize: 10 },
});

export function PayoutReceiptTemplate({ data }: { data: PayoutReceiptData }) {
  const amountText = `$${data.amount.toFixed(2)} ${data.currency || "MXN"}`;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Handi - Payout Receipt</Text>
        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.label}>Payout ID</Text>
            <Text style={[styles.value, styles.code]}>{data.payoutId}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Fecha</Text>
            <Text style={styles.value}>{data.createdAtISO}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Profesional</Text>
          <Text style={styles.value}>
            {data.professionalName || "Profesional"}
          </Text>
          <Text style={styles.value}>{data.professionalEmail || "-"}</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.label}>Monto</Text>
            <Text style={styles.value}>{amountText}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Request ID</Text>
            <Text style={[styles.value, styles.code]}>
              {data.requestId || "-"}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Agreement ID</Text>
            <Text style={[styles.value, styles.code]}>
              {data.agreementId || "-"}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Transfer ID</Text>
            <Text style={[styles.value, styles.code]}>
              {data.transferId || "-"}
            </Text>
          </View>
        </View>

        <Text style={styles.label}>Gracias por confiar en Handi.</Text>
      </Page>
    </Document>
  );
}
