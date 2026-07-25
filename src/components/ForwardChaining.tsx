import { useEffect, useState } from "react";
import rulesData from "../rules.json"; // sesuaikan path

export default function ForwardChaining({ userFakta }: { userFakta: string[] }) {
  const [hasil, setHasil] = useState<{ kesimpulan: string; cf: number }[]>([]);

  useEffect(() => {
    if (userFakta.length > 0) {
      const hasilFC = runForwardChaining(userFakta, rulesData as any[]);
      setHasil(hasilFC);
    } else {
      setHasil([]);
    }
  }, [userFakta]);

  return (
    <div>
      <h3>Hasil Diagnosa:</h3>
      {hasil.length === 0 && <p>Tidak ada masalah yang terdeteksi.</p>}
      {hasil.map((item, idx) => (
        <p key={idx}>
          {item.kesimpulan}: {(item.cf * 100).toFixed(1)}%
        </p>
      ))}
    </div>
  );
}

// Fungsi Forward Chaining + Confidence Factor
function runForwardChaining(faktaUser: string[], rules: any[]) {
  const kesimpulanMap: Record<string, number> = {};

  rules.forEach((rule) => {
    const match = rule.kondisi.every((kondisi: string) => faktaUser.includes(kondisi));
    if (match) {
      if (kesimpulanMap[rule.kesimpulan]) {
        const existingCF = kesimpulanMap[rule.kesimpulan];
        kesimpulanMap[rule.kesimpulan] = 1 - (1 - existingCF) * (1 - rule.bobot);
      } else {
        kesimpulanMap[rule.kesimpulan] = rule.bobot;
      }
    }
  });

  return Object.keys(kesimpulanMap).map((key) => ({
    kesimpulan: key,
    cf: kesimpulanMap[key],
  }));
}

