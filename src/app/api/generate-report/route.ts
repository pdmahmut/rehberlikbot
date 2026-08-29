import { NextRequest, NextResponse } from "next/server";
import { requireSession } from '@/lib/apiAuth';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

interface ReportRequest {
  studentName: string;
  studentClass: string;
  appointmentDate: string;
  topicTags: string[];
  purpose: string;
  outcome: string;
  decisions: string[];
  sessionNotes: string;
  reportType: "idare" | "ogretmen" | "veli" | "rehberlik";
}

const REPORT_PROMPTS: Record<string, string> = {
  idare: `Sen bir okul psikolojik danışmanısın. Aşağıdaki bilgilere göre okul idaresi için resmi bir bilgilendirme raporu hazırla.

Rapor şu bölümleri içermeli:
1. Başlık ve tarih bilgileri
2. Öğrenci bilgileri (ad, sınıf)
3. Görüşme özeti
4. Değerlendirme
5. Risk faktörleri varsa uyarı
6. İdari işlem önerileri (devamsızlık, disiplin vb. durumlar varsa)
7. Kapanış ve imza

Resmi, profesyonel ve net bir dil kullan. Türkçe yaz.`,

  ogretmen: `Sen bir okul psikolojik danışmanısın. Aşağıdaki bilgilere göre sınıf öğretmeni için bir bilgilendirme notu hazırla.

Rapor şu bölümleri içermeli:
1. Samimi ama profesyonel bir selamlama
2. Görüşme konusu ve tarihi
3. Görüşme notu özeti
4. Sınıf içi öneriler (dikkat, sosyal ilişkiler, akademik, kaygı durumuna göre)
5. İletişim bilgisi

Öğretmenin sınıf içinde uygulayabileceği pratik öneriler ver. Türkçe yaz.`,

  veli: `Sen bir okul psikolojik danışmanısın. Aşağıdaki bilgilere göre veli için anlaşılır ve destekleyici bir bilgilendirme mektubu hazırla.

Rapor şu bölümleri içermeli:
1. Saygılı bir selamlama
2. Görüşme bilgileri
3. Görüşme içeriği özeti (teknik terimler kullanmadan)
4. Ev ortamı için pratik öneriler
5. İletişim ve iş birliği çağrısı
6. Kapanış

Veli için anlaşılır, destekleyici ve iş birliğine teşvik edici bir dil kullan. Türkçe yaz.`,

  rehberlik: `Sen bir okul psikolojik danışmanısın. Aşağıdaki bilgilere göre rehberlik dosyası için detaylı bir görüşme kaydı hazırla.

Rapor şu bölümleri içermeli:
1. Genel bilgiler (tarih, öğrenci, sınıf)
2. Başvuru/yönlendirilme nedeni
3. Görüşme içeriği (detaylı)
4. Gözlemler (sözel olmayan iletişim, duygu durumu, davranış)
5. Değerlendirme ve formülasyon
6. Müdahale planı
7. Sonraki adımlar ve takip

Profesyonel, detaylı ve dosyalama için uygun bir format kullan. Türkçe yaz.`
};

export async function POST(request: NextRequest) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;

  try {
    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "Gemini API anahtarı yapılandırılmamış" },
        { status: 500 }
      );
    }

    const body: ReportRequest = await request.json();
    const { studentName, studentClass, appointmentDate, topicTags, purpose, outcome, decisions, sessionNotes, reportType } = body;

    if (!sessionNotes || !reportType) {
      return NextResponse.json(
        { error: "Görüşme notları ve rapor tipi gereklidir" },
        { status: 400 }
      );
    }

    const systemPrompt = REPORT_PROMPTS[reportType];
    if (!systemPrompt) {
      return NextResponse.json(
        { error: "Geçersiz rapor tipi" },
        { status: 400 }
      );
    }

    const userPrompt = `
Öğrenci Bilgileri:
- Ad: ${studentName}
- Sınıf: ${studentClass}
- Görüşme Tarihi: ${appointmentDate}
- Konu Etiketleri: ${topicTags?.join(", ") || "Genel"}
- Görüşme Amacı: ${purpose || "Rehberlik görüşmesi"}
${outcome ? `- Görüşme Sonucu: ${outcome}` : ""}
${decisions?.length ? `- Alınan Kararlar: ${decisions.join(", ")}` : ""}

Görüşme Notları:
${sessionNotes}

Lütfen yukarıdaki bilgilere göre ${reportType === "idare" ? "idare bilgilendirme raporu" : reportType === "ogretmen" ? "öğretmen bilgilendirme notu" : reportType === "veli" ? "veli bilgilendirme mektubu" : "rehberlik dosyası görüşme kaydı"} oluştur.`;

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: systemPrompt + "\n\n" + userPrompt }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          }
        ]
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Gemini API Error:", errorData);
      return NextResponse.json(
        { error: "Gemini API hatası: " + (errorData.error?.message || "Bilinmeyen hata") },
        { status: response.status }
      );
    }

    const data = await response.json();
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
      return NextResponse.json(
        { error: "Rapor oluşturulamadı" },
        { status: 500 }
      );
    }

    return NextResponse.json({ report: generatedText });
  } catch (error) {
    console.error("Generate report error:", error);
    return NextResponse.json(
      { error: "Rapor oluşturulurken bir hata oluştu" },
      { status: 500 }
    );
  }
}
