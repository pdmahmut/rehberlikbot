import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

type DocumentType = "veli-mektubu" | "veli-cagrisi" | "ogretmen-mektubu" | "ogretmen-tavsiyesi" | "idare-mektubu" | "disiplin-kurulu";

interface DocumentRequest {
  documentType: DocumentType;
  currentContent: string;
  studentName: string;
  studentClass: string;
  meetingDate?: string;
  meetingTime?: string;
}

// Her belge türü için HTML format talimatları
const HTML_FORMAT_INSTRUCTION = `
ÇIKTI FORMATI KURALLARI (ÇOK ÖNEMLİ - MUTLAKA UYULMALI):

1. Sadece HTML etiketleri kullan, markdown kullanma
2. Her paragraf için <p>...</p> kullan
3. Başlıklar için <p style="text-align: center"><strong>BAŞLIK</strong></p> kullan
4. Normal metin için <p>metin</p> kullan
5. Kalın metin için <strong>...</strong> kullan
6. Liste için <ul><li>...</li></ul> veya <ol><li>...</li></ol> kullan
7. Boş satır için <p></p> kullan
8. Sağa hizalı metin için <p style="text-align: right">...</p> kullan
9. Ortaya hizalı metin için <p style="text-align: center">...</p> kullan

YAPISAL ŞABLON (BU YAPIYI KORU):
- Üst başlıklar: T.C., Kaymakamlık, Okul, Rehberlik Servisi (hepsi ortaya hizalı, kalın)
- Ana başlık: Belge türü başlığı (ortaya hizalı, kalın)
- Boş satır
- Hitap satırı
- Boş satır
- Ana paragraflar
- Boş satır
- İmza bloğu (tarih, ad, ünvan - sağa hizalı)

Öğrenci adını her zaman tırnak içinde ve kalın yaz: "<strong>Öğrenci Adı</strong>"
`;

const DOCUMENT_PROMPTS: Record<DocumentType, string> = {
  "veli-mektubu": `Sen deneyimli bir okul psikolojik danışmanısın. Mevcut veli mektubunu geliştir.

${HTML_FORMAT_INSTRUCTION}

İÇERİK GELİŞTİRME:
1. Samimi ama profesyonel dil kullan
2. Empati cümleleri ekle (velinin endişelerini anladığını göster)
3. Çocuğun potansiyelini vurgula
4. Veli-okul işbirliğinin önemini belirt
5. Randevu/görüşme talebi açık ve kibar olsun
6. Kapanış olumlu ve destekleyici olsun

Mevcut içeriğin yapısını, başlık formatını ve öğrenci bilgilerini AYNEN KORU. Sadece ana paragrafları zenginleştir.`,

  "veli-cagrisi": `Sen deneyimli bir okul psikolojik danışmanısın. Mevcut veli çağrı belgesini geliştir.

${HTML_FORMAT_INSTRUCTION}

İÇERİK GELİŞTİRME:
1. Resmi ama sıcak ton kullan
2. Görüşme amacını olumlu şekilde açıkla
3. Tarih/saat/yer bilgilerini vurgulu tut
4. Velinin hazırlıklı gelmesi için ipuçları ekle
5. İletişim bilgilerini belirt
6. Teşekkür ve beklenti ifadesi samimi olsun

Mevcut içeriğin yapısını, başlık formatını, tarih/saat bilgilerini ve öğrenci bilgilerini AYNEN KORU. Sadece açıklama paragraflarını zenginleştir.`,

  "ogretmen-mektubu": `Sen deneyimli bir okul psikolojik danışmanısın. Mevcut öğretmen mektubunu geliştir.

${HTML_FORMAT_INSTRUCTION}

İÇERİK GELİŞTİRME:
1. Meslektaşlar arası profesyonel ve saygılı ton kullan
2. Öğrenci hakkında istenen bilgileri net belirt
3. Sınıf ortamında dikkat edilecek noktaları sor
4. Pratik öneriler için alan bırak
5. İşbirliği çağrısı ekle
6. Gizlilik hatırlatması yap

Mevcut içeriğin yapısını, başlık formatını, liste yapısını ve öğrenci bilgilerini AYNEN KORU. Sadece açıklama paragraflarını zenginleştir.`,

  "ogretmen-tavsiyesi": `Sen deneyimli bir okul psikolojik danışmanısın. Mevcut öğretmen tavsiye formunu geliştir.

${HTML_FORMAT_INSTRUCTION}

İÇERİK GELİŞTİRME:
1. Form yapısını koru (checkbox'lar, boşluklar)
2. Akademik, davranış ve katılım değerlendirme bölümlerini tut
3. Öneriler bölümünü genişlet
4. Her kategori için pratik stratejiler ekle
5. İzleme ve geri bildirim süreci belirt

Mevcut içeriğin yapısını, başlık formatını, form alanlarını (☐ işaretleri, alt çizgiler) ve öğrenci bilgilerini AYNEN KORU. Sadece açıklama metinlerini zenginleştir.`,

  "idare-mektubu": `Sen deneyimli bir okul psikolojik danışmanısın. Mevcut idare mektubunu geliştir.

${HTML_FORMAT_INSTRUCTION}

İÇERİK GELİŞTİRME:
1. Resmi yazışma formatını koru
2. Durumu objektif ve net özetle
3. Yapılan çalışmaları detaylandır
4. Önerileri numaralı liste olarak sun
5. Risk değerlendirmesi varsa profesyonel belirt
6. Takip planı öner

Mevcut içeriğin yapısını, başlık formatını, liste yapısını ve öğrenci bilgilerini AYNEN KORU. Sadece içerik paragraflarını zenginleştir.`,

  "disiplin-kurulu": `Sen deneyimli bir okul psikolojik danışmanısın. Mevcut disiplin kurulu belgesini geliştir.

${HTML_FORMAT_INSTRUCTION}

İÇERİK GELİŞTİRME:
1. Resmi kurumsal formatı koru
2. Toplantı bilgilerini (tarih, saat, yer) vurgulu tut
3. Soruşturma konusu alanını koru
4. Önemli notları profesyonel ve yasal dilde yaz
5. Velinin hakları hakkında bilgilendirme ekle
6. Mazeretsiz katılmama durumunu belirt

Mevcut içeriğin yapısını, başlık formatını, liste yapısını, toplantı bilgilerini ve öğrenci bilgilerini AYNEN KORU. Sadece açıklama metinlerini zenginleştir.`
};

function htmlToPlainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function POST(request: NextRequest) {
  try {
    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "Gemini API anahtarı yapılandırılmamış" },
        { status: 500 }
      );
    }

    const body: DocumentRequest = await request.json();
    const { documentType, currentContent, studentName, studentClass, meetingDate, meetingTime } = body;

    if (!documentType || !currentContent) {
      return NextResponse.json(
        { error: "Belge türü ve mevcut içerik gereklidir" },
        { status: 400 }
      );
    }

    const systemPrompt = DOCUMENT_PROMPTS[documentType];
    if (!systemPrompt) {
      return NextResponse.json(
        { error: "Geçersiz belge türü" },
        { status: 400 }
      );
    }

    const userPrompt = `
ÖĞRENCİ BİLGİLERİ:
- Ad Soyad: ${studentName || "[Öğrenci Seçilmedi]"}
- Sınıf: ${studentClass || "[Sınıf Seçilmedi]"}
${meetingDate ? `- Görüşme Tarihi: ${meetingDate}` : ""}
${meetingTime ? `- Görüşme Saati: ${meetingTime}` : ""}

MEVCUT HTML İÇERİK (BU FORMATI AYNEN KULLAN):
${currentContent}

TALİMAT: Yukarıdaki HTML belgeyi geliştir. 
- Başlık yapısını (T.C., Kaymakamlık, Okul, Rehberlik) AYNEN koru
- Öğrenci adı ve sınıf bilgilerini AYNEN koru
- Tarih ve imza bloğunu AYNEN koru
- Sadece ana paragrafları daha zengin ve profesyonel yaz
- HTML etiketlerini (<p>, <strong>, <ul>, <li>, style="text-align: center" vb.) AYNEN kullan
- Markdown kullanma, sadece HTML döndür
- Açıklama yazma, sadece HTML içerik döndür`;

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
          temperature: 0.5,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 4096,
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
    let generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
      return NextResponse.json(
        { error: "Belge oluşturulamadı" },
        { status: 500 }
      );
    }

    // Temizlik işlemleri
    generatedText = generatedText
      // Code block'ları temizle
      .replace(/```html\n?/gi, '')
      .replace(/```\n?/g, '')
      // Baştaki ve sondaki boşlukları temizle
      .trim();

    // Eğer HTML tag'leri yoksa, orijinal içeriği dön
    if (!generatedText.includes('<p') && !generatedText.includes('<div')) {
      // Markdown'ı HTML'e çevir
      generatedText = generatedText
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .split('\n\n')
        .map((p: string) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
        .join('');
    }

    return NextResponse.json({ document: generatedText });
  } catch (error) {
    console.error("Generate document error:", error);
    return NextResponse.json(
      { error: "Belge oluşturulurken bir hata oluştu" },
      { status: 500 }
    );
  }
}
