-- individual_requests tablosu "randevu verildi" durumunu saklayamiyordu.
--
-- Kisit yalnizca ('pending','completed','cancelled') degerlerine izin
-- veriyordu. Bireysel basvuruya randevu verildiginde sunucu once
-- 'scheduled' yazmayi deniyor, kisit reddedince aday listesindeki son
-- secenege dusup 'pending' yaziyordu (bkz. getStatusCandidatesForSource).
--
-- Sonucu: randevusu olan bir bireysel basvuru veritabaninda "bekliyor"
-- olarak duruyordu. Basvurular ekrani onu bekleyen bir basvuru sanip
-- "randevuya sonradan dahil edildi" anlaminda "yeni" rozetiyle
-- gosteriyordu; oysa basvuru randevudan onceydi ve zaten baglanmisti.
--
-- Diger dort kanalin tablosu bu durumu kendi kelimesiyle saklayabiliyor:
-- veli talebi 'scheduled', ogrenci bildirimi 'reviewing', rehberlik
-- istegi 'converted', ogretmen yonlendirmesi 'Randevu verildi'.
--
-- Mevcut satirlar etkilenmez; kisit yalnizca genisletiliyor.

ALTER TABLE public.individual_requests
  DROP CONSTRAINT IF EXISTS individual_requests_status_check;

ALTER TABLE public.individual_requests
  ADD CONSTRAINT individual_requests_status_check
  CHECK (status IN ('pending', 'scheduled', 'completed', 'cancelled'));
