"use client"

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { Plus, CheckCircle2, Clock, Calendar, BookOpen, X, AlertTriangle, Sparkles, CircleDashed, Trash2 } from "lucide-react"

type GuidanceTopic = {
  id: string
  title: string
  grade_levels: number[]
  status: 'active' | 'completed' | 'archived'
  notes: string | null
  created_at: string
  school_year: string | null
  plans?: GuidancePlan[]
}

type GuidancePlan = {
  id: string
  topic_id: string
  class_key: string
  class_display: string
  status: 'unplanned' | 'planned' | 'completed'
  plan_date: string | null
  lesson_period: number | null
  teacher_name: string | null
  completed_at: string | null
}

const CLASSES = [
  { key: '5A', display: '5-A', grade: 5 },
  { key: '5B', display: '5-B', grade: 5 },
  { key: '5C', display: '5-C', grade: 5 },
  { key: '6A', display: '6-A', grade: 6 },
  { key: '6B', display: '6-B', grade: 6 },
  { key: '6C', display: '6-C', grade: 6 },
  { key: '7A', display: '7-A', grade: 7 },
  { key: '7B', display: '7-B', grade: 7 },
  { key: '7C', display: '7-C', grade: 7 },
  { key: '8A', display: '8-A', grade: 8 },
  { key: '8B', display: '8-B', grade: 8 },
  { key: '8C', display: '8-C', grade: 8 },
]

const MONTHS_TR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']
const DAYS_TR = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi']

function formatDateTR(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getDate()} ${MONTHS_TR[d.getMonth()]} ${DAYS_TR[d.getDay()]}`
}

export default function SinifRehberligiPage() {
  const [topics, setTopics] = useState<GuidanceTopic[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'planlama' | 'gecmis'>('planlama')

  const [showNewTopicModal, setShowNewTopicModal] = useState(false)
  const [newTopicTitle, setNewTopicTitle] = useState("")
  const [newTopicGrades, setNewTopicGrades] = useState<number[]>([])
  const [newTopicYear, setNewTopicYear] = useState("2025-2026")
  const [creating, setCreating] = useState(false)

  const [selectedGrade, setSelectedGrade] = useState<number | null>(null)
  const [historyTopics, setHistoryTopics] = useState<GuidanceTopic[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const [showPlanModal, setShowPlanModal] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<GuidancePlan | null>(null)
  const [planDate, setPlanDate] = useState("")
  const [planPeriod, setPlanPeriod] = useState<number | null>(null)
  const [planTeacher, setPlanTeacher] = useState("")
  const [conflictWarning, setConflictWarning] = useState<string | null>(null)
  const [savingPlan, setSavingPlan] = useState(false)

  const [showGradeManagementModal, setShowGradeManagementModal] = useState(false)
  const [selectedTopicForGrades, setSelectedTopicForGrades] = useState<GuidanceTopic | null>(null)
  const [managedGrades, setManagedGrades] = useState<number[]>([])
  const [savingGrades, setSavingGrades] = useState(false)

  const fetchTopics = useCallback(async () => {
    setLoading(true)
    try {
      const { data: topicsData, error } = await supabase
        .from('guidance_topics')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      if (error) throw error

      const topicsWithPlans = await Promise.all(
        (topicsData || []).map(async (topic) => {
          const { data: plans } = await supabase
            .from('guidance_plans')
            .select('*')
            .eq('topic_id', topic.id)
            .order('class_key')
          return { ...topic, plans: plans || [] }
        })
      )

      // Tüm kartları completed olan konuları otomatik olarak completed yap
      const completedTopicIds: string[] = []
      for (const topic of topicsWithPlans) {
        if (topic.plans.length > 0) {
          const allPlansCompleted = topic.plans.every(p => p.status === 'completed')
          if (allPlansCompleted && topic.status !== 'completed') {
            console.log(`Auto-completing topic: ${topic.title}`)
            await supabase
              .from('guidance_topics')
              .update({ status: 'completed' })
              .eq('id', topic.id)
            completedTopicIds.push(topic.id)
          }
        }
      }

      // Completed olanları state'ten çıkar
      const filteredTopics = topicsWithPlans.filter(t => !completedTopicIds.includes(t.id))
      setTopics(filteredTopics)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTopics() }, [fetchTopics])

  const fetchHistory = useCallback(async (grade: number) => {
    setHistoryLoading(true)
    try {
      const { data } = await supabase
        .from('guidance_topics')
        .select('*')
        .contains('grade_levels', [grade])
        .eq('status', 'completed')
        .order('school_year', { ascending: false })
        .order('created_at', { ascending: false })
      setHistoryTopics(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedGrade) fetchHistory(selectedGrade)
  }, [selectedGrade, fetchHistory])

  // guidance_plans veya guidance_topics tablosu değişince kartları otomatik yenile
  useEffect(() => {
    const channel = supabase
      .channel('guidance-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'guidance_plans' },
        () => { fetchTopics() }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'guidance_topics' },
        () => { fetchTopics() }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchTopics])

  const handleCreateTopic = async () => {
    if (!newTopicTitle.trim() || newTopicGrades.length === 0) return
    setCreating(true)
    try {
      const { data: topic, error } = await supabase
        .from('guidance_topics')
        .insert({ title: newTopicTitle.trim(), grade_levels: newTopicGrades, school_year: newTopicYear })
        .select()
        .single()
      if (error) throw error

      const classesToAdd = CLASSES.filter(c => newTopicGrades.includes(c.grade))
      await supabase.from('guidance_plans').insert(
        classesToAdd.map(c => ({
          topic_id: topic.id,
          class_key: c.key,
          class_display: c.display,
          status: 'unplanned'
        }))
      )
      setShowNewTopicModal(false)
      setNewTopicTitle("")
      setNewTopicGrades([])
      setNewTopicYear("2025-2026")
      fetchTopics()
    } catch (err) {
      console.error(err)
    } finally {
      setCreating(false)
    }
  }

  const checkConflict = useCallback(async (date: string, period: number) => {
    if (!date || !period) { setConflictWarning(null); return }
    const { data } = await supabase
      .from('guidance_plans')
      .select('id, class_display')
      .eq('status', 'planned')
      .eq('plan_date', date)
      .eq('lesson_period', period)
      .neq('id', selectedPlan?.id || '')
    if (data && data.length > 0) {
      setConflictWarning(`Bu saatte zaten ${data[0].class_display} planlanmış!`)
    } else {
      setConflictWarning(null)
    }
  }, [selectedPlan?.id])

  const handleSavePlan = async () => {
    if (!selectedPlan || !planDate || !planPeriod || conflictWarning) return
    setSavingPlan(true)
    try {
      // Planı kaydet
      await supabase
        .from('guidance_plans')
        .update({ status: 'planned', plan_date: planDate, lesson_period: planPeriod, teacher_name: planTeacher.trim() || null })
        .eq('id', selectedPlan.id)

      // Mevcut görevi bul (daha önce oluşturulmuş mu?)
      const { data: existingTask } = await supabase
        .from('tasks')
        .select('id')
        .eq('related_guidance_plan_id', selectedPlan.id)
        .maybeSingle()

      const topic = topics.find(t => t.id === selectedPlan.topic_id)
      const taskTitle = `${selectedPlan.class_display} — ${topic?.title || 'Sınıf Rehberliği'} (${planPeriod}. ders)`

      if (existingTask) {
        // Mevcut görevi güncelle
        await supabase
          .from('tasks')
          .update({ title: taskTitle, due_date: planDate, status: 'pending', completed_at: null })
          .eq('id', existingTask.id)
      } else {
        // Yeni görev oluştur
        await supabase.from('tasks').insert({
          title: taskTitle,
          category: 'ogretmen',
          priority: 'normal',
          status: 'pending',
          due_date: planDate,
          related_guidance_plan_id: selectedPlan.id
        })
      }

      // Plan'ı güncelle ve modalı yenile et (kapanma!)
      setSelectedPlan({ ...selectedPlan, status: 'planned' as const })
      fetchTopics()
    } catch (err) {
      console.error(err)
    } finally {
      setSavingPlan(false)
    }
  }

  const handleCompletePlan = async (plan: GuidancePlan) => {
    try {
      console.log('Starting to complete plan:', plan.id, 'for topic:', plan.topic_id)
      
      // Plan'ı completed yap
      const { error: updateError } = await supabase
        .from('guidance_plans')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', plan.id)
      
      if (updateError) {
        console.error('Plan update error:', updateError)
        throw updateError
      }
      console.log('Plan updated successfully')

      // İlgili görevi de tamamlandı yap
      await supabase
        .from('tasks')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('related_guidance_plan_id', plan.id)

      // Biraz bekle - veri tabanı senkronizasyonu için
      await new Promise(resolve => setTimeout(resolve, 500))

      const { data: allPlans, error: fetchError } = await supabase
        .from('guidance_plans')
        .select('id, status')
        .eq('topic_id', plan.topic_id)

      if (fetchError) {
        console.error('Fetch plans error:', fetchError)
        throw fetchError
      }

      console.log('All plans:', allPlans)

      // Tüm planların tamamlandı olup olmadığını kontrol et
      const allDone = allPlans?.every(p => p.status === 'completed')
      console.log('All done?', allDone, 'Plans:', allPlans?.map(p => ({ id: p.id, status: p.status })))
      
      if (allDone) {
        console.log('Marking topic as completed...')
        const { error: topicError } = await supabase
          .from('guidance_topics')
          .update({ status: 'completed' })
          .eq('id', plan.topic_id)
        
        if (topicError) {
          console.error('Topic update error:', topicError)
        } else {
          console.log('Topic marked as completed successfully')
        }
      } else {
        console.log('Not all plans are completed, not marking topic as completed')
      }
      
      console.log('Calling fetchTopics...')
      setShowPlanModal(false)
      await fetchTopics()
      console.log('fetchTopics completed')
    } catch (err) {
      console.error('Complete plan error:', err)
    }
  }

  const handleCancelPlan = async (plan: GuidancePlan) => {
    try {
      await supabase
        .from('guidance_plans')
        .update({ status: 'unplanned', plan_date: null, lesson_period: null })
        .eq('id', plan.id)

      // İlgili görevi sil
      await supabase
        .from('tasks')
        .delete()
        .eq('related_guidance_plan_id', plan.id)

      fetchTopics()
    } catch (err) {
      console.error(err)
    }
  }

  const openPlanModal = (plan: GuidancePlan) => {
    setSelectedPlan(plan)
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`
    setPlanDate(plan.plan_date || todayStr)
    setPlanPeriod(plan.lesson_period || null)
    setPlanTeacher(plan.teacher_name || "")
    setConflictWarning(null)
    setShowPlanModal(true)
  }

  const toggleGrade = (grade: number) => {
    setNewTopicGrades(prev =>
      prev.includes(grade) ? prev.filter(g => g !== grade) : [...prev, grade]
    )
  }

  const handleDeleteTopic = async (topicId: string) => {
    if (!confirm('Bu konuyu ve tüm planlarını silmek istediğinize emin misiniz?')) return
    try {
      // Bağlı task'ları sil
      const { data: plans } = await supabase
        .from('guidance_plans')
        .select('id')
        .eq('topic_id', topicId)
      
      if (plans && plans.length > 0) {
        const planIds = plans.map(p => p.id)
        await supabase.from('tasks').delete().in('related_guidance_plan_id', planIds)
        await supabase.from('guidance_plans').delete().eq('topic_id', topicId)
      }

      await supabase.from('guidance_topics').delete().eq('id', topicId)
      fetchTopics()
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeletePlan = async (plan: GuidancePlan) => {
    if (!confirm(`${plan.class_display} sınıfı için oluşturulan bu kartı silmek istediğinize emin misiniz?`)) return
    try {
      // İlgili task'ı sil
      await supabase
        .from('tasks')
        .delete()
        .eq('related_guidance_plan_id', plan.id)

      // Plan'ı sil
      await supabase
        .from('guidance_plans')
        .delete()
        .eq('id', plan.id)

      setShowPlanModal(false)
      setSelectedPlan(null)
      fetchTopics()
    } catch (err) {
      console.error(err)
    }
  }

  const openGradeManagementModal = (topic: GuidanceTopic) => {
    setSelectedTopicForGrades(topic)
    setManagedGrades([...topic.grade_levels].sort())
    setShowGradeManagementModal(true)
  }

  const handleSaveGrades = async () => {
    if (!selectedTopicForGrades) return
    setSavingGrades(true)
    try {
      const currentGrades = selectedTopicForGrades.grade_levels
      const gradesToAdd = managedGrades.filter(g => !currentGrades.includes(g))
      const gradesToRemove = currentGrades.filter(g => !managedGrades.includes(g))

      // Silinecek kademeler için ilgili plan ve task'ları sil
      if (gradesToRemove.length > 0) {
        const classesToRemove = CLASSES.filter(c => gradesToRemove.includes(c.grade))
        const classKeysToRemove = classesToRemove.map(c => c.key)

        // Plans'ları bul
        const { data: plansToDelete } = await supabase
          .from('guidance_plans')
          .select('id')
          .eq('topic_id', selectedTopicForGrades.id)
          .in('class_key', classKeysToRemove)

        if (plansToDelete && plansToDelete.length > 0) {
          const planIds = plansToDelete.map(p => p.id)
          // Tasks'ları sil
          await supabase.from('tasks').delete().in('related_guidance_plan_id', planIds)
          // Plans'ları sil
          await supabase.from('guidance_plans').delete().in('id', planIds)
        }
      }

      // Eklenecek kademeler için yeni plan'lar oluştur
      if (gradesToAdd.length > 0) {
        const classesToAdd = CLASSES.filter(c => gradesToAdd.includes(c.grade))
        await supabase.from('guidance_plans').insert(
          classesToAdd.map(c => ({
            topic_id: selectedTopicForGrades.id,
            class_key: c.key,
            class_display: c.display,
            status: 'unplanned'
          }))
        )
      }

      // Konunun grade_levels'ini güncelle
      await supabase
        .from('guidance_topics')
        .update({ grade_levels: managedGrades })
        .eq('id', selectedTopicForGrades.id)

      setShowGradeManagementModal(false)
      setSelectedTopicForGrades(null)
      setManagedGrades([])
      fetchTopics()
    } catch (err) {
      console.error(err)
    } finally {
      setSavingGrades(false)
    }
  }

  const toggleManagedGrade = (grade: number) => {
    setManagedGrades(prev =>
      prev.includes(grade) ? prev.filter(g => g !== grade) : [...prev, grade].sort()
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-emerald-500/30 rounded-full animate-spin border-t-emerald-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Üst Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25">
            <BookOpen className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Sınıf Rehberliği</h1>
            <p className="text-sm text-slate-500">Konu bazlı sınıf takip ve planlama</p>
          </div>
        </div>
        {activeTab === 'planlama' && (
          <button
            onClick={() => setShowNewTopicModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-semibold rounded-xl shadow-lg shadow-emerald-500/25 hover:from-emerald-600 hover:to-teal-700 transition-all"
          >
            <Plus className="h-4 w-4" />
            Yeni Konu
          </button>
        )}
      </div>

      {/* Sekmeler */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('planlama')}
          className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'planlama'
              ? 'border-emerald-500 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          📋 Bu Yıl
        </button>
        <button
          onClick={() => setActiveTab('gecmis')}
          className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'gecmis'
              ? 'border-emerald-500 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          🗂️ Geçmiş Kayıtlar
        </button>
      </div>

      {/* GEÇMİŞ SEKMESİ */}
      {activeTab === 'gecmis' && (
        <div className="space-y-5">
          {/* Kademe seçimi */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <p className="text-sm font-semibold text-slate-600 mb-3">Hangi kademenin geçmişini görmek istiyorsunuz?</p>
            <div className="flex gap-3">
              {[5, 6, 7, 8].map(grade => (
                <button
                  key={grade}
                  onClick={() => setSelectedGrade(grade)}
                  className={`flex-1 py-3 rounded-xl text-sm font-bold border-2 transition-all ${
                    selectedGrade === grade
                      ? 'bg-emerald-500 border-emerald-500 text-white shadow-md'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-300'
                  }`}
                >
                  {grade}. Sınıf
                </button>
              ))}
            </div>
          </div>

          {/* Sonuçlar */}
          {selectedGrade && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
                <h2 className="text-base font-bold text-slate-800">{selectedGrade}. Sınıf — Tüm Yıllar</h2>
                <p className="text-sm text-slate-500">Bu kademeye daha önce anlatılan konular</p>
              </div>
              {historyLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="w-6 h-6 border-4 border-emerald-500/30 rounded-full animate-spin border-t-emerald-500" />
                </div>
              ) : historyTopics.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-slate-400">
                  <p className="font-medium">Kayıt bulunamadı</p>
                  <p className="text-sm mt-1">Bu kademe için henüz konu girilmemiş</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {Object.entries(
                    historyTopics.reduce((acc, topic) => {
                      const year = topic.school_year || 'Bilinmiyor'
                      if (!acc[year]) acc[year] = []
                      acc[year].push(topic)
                      return acc
                    }, {} as Record<string, GuidanceTopic[]>)
                  ).map(([year, yearTopics]) => (
                    <div key={year} className="p-5">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">{year} Okul Yılı</p>
                      <div className="space-y-2">
                        {yearTopics.map(topic => (
                          <div key={topic.id} className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full shrink-0 ${topic.status === 'completed' ? 'bg-emerald-500' : 'bg-blue-400'}`} />
                            <span className="text-sm text-slate-700 font-medium">{topic.title}</span>
                            <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${
                              topic.status === 'completed'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}>
                              {topic.status === 'completed' ? 'Tamamlandı' : 'Bu yıl devam ediyor'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* PLANLAMA SEKMESİ */}
      {activeTab === 'planlama' && (
        <div className="space-y-6">

      {/* Boş durum */}
      {topics.filter(t => t.status === 'active').length === 0 && (
        <div className="flex flex-col items-center justify-center h-64 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <BookOpen className="h-12 w-12 text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">Henüz konu eklenmemiş</p>
          <p className="text-slate-400 text-sm mt-1">Yeni Konu butonuyla başlayabilirsiniz</p>
        </div>
      )}

      {/* Konular */}
      {topics.filter(t => t.status === 'active').map(topic => {
        const plans = topic.plans || []
        const completedCount = plans.filter(p => p.status === 'completed').length
        const totalCount = plans.length
        const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
        const isCompleted = topic.status === 'completed'

        return (
          <div key={topic.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${isCompleted ? 'border-emerald-200' : 'border-slate-200'}`}>
            {/* Konu Başlığı */}
            <div className={`px-5 py-4 border-b ${isCompleted ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {isCompleted
                    ? <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                    : <Clock className="h-5 w-5 text-blue-500 shrink-0" />
                  }
                  <h2 className="text-base font-bold text-slate-800 truncate">{topic.title}</h2>
                  <div className="flex gap-1.5 shrink-0">
                    {[...topic.grade_levels].sort().map(g => (
                      <span key={g} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                        {g}. Sınıf
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-medium text-slate-600">{completedCount}/{totalCount}</span>
                  <div className="w-32 h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${isCompleted ? 'bg-emerald-500' : 'bg-blue-500'}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold text-slate-700 w-10 text-right">{progress}%</span>
                  <button
                    onClick={() => openGradeManagementModal(topic)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition-all"
                    title="Kademeler ekle/sil"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteTopic(topic.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                    title="Konuyu sil"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Sınıf Kartları */}
            <div className="p-4 grid grid-cols-3 gap-3">
              {plans.map(plan => (
                <div
                  key={plan.id}
                  className={`rounded-2xl border-2 p-4 flex flex-col transition-all select-none h-40 relative group ${
                    plan.status === 'completed'
                      ? 'bg-gradient-to-br from-emerald-400 to-teal-500 border-emerald-300 shadow-lg shadow-emerald-200'
                      : plan.status === 'planned'
                      ? 'bg-gradient-to-br from-blue-400 to-indigo-500 border-blue-300 shadow-md shadow-blue-200 hover:shadow-lg hover:scale-[1.03]'
                      : 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200 hover:border-amber-400 hover:shadow-md hover:scale-[1.03]'
                  }`}
                >
                  {/* Kartın ana içeriği — tıklanabilir */}
                  <div onClick={() => openPlanModal(plan)} className="cursor-pointer flex-1 flex flex-col">
                    {/* Sınıf adı — üst */}
                    <span className={`text-2xl font-black tracking-tight leading-none ${
                      plan.status === 'unplanned' ? 'text-amber-800' : 'text-white drop-shadow'
                    }`}>
                      {plan.class_display}
                    </span>

                    {/* Alt içerik — flex-1 ile kalan alanı kaplar */}
                    <div className="flex-1 flex flex-col justify-end gap-1.5">

                    {/* Tamamlandı */}
                    {plan.status === 'completed' && (
                      <>
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="h-5 w-5 text-white" />
                          <span className="text-base font-bold text-white">Tamamlandı</span>
                        </div>
                        {plan.plan_date && (
                          <span className="text-sm text-emerald-100 font-medium">{formatDateTR(plan.plan_date)}</span>
                        )}
                        {plan.teacher_name && (
                          <span className="text-sm text-emerald-100 truncate">👤 {plan.teacher_name}</span>
                        )}
                      </>
                    )}

                    {/* Planlandı */}
                    {plan.status === 'planned' && (
                      <>
                        {plan.plan_date && (
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-4 w-4 text-blue-100 shrink-0" />
                            <span className="text-sm font-bold text-white leading-tight">{formatDateTR(plan.plan_date)}</span>
                          </div>
                        )}
                        {plan.lesson_period && (
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-4 w-4 text-blue-200 shrink-0" />
                            <span className="text-sm text-blue-100 font-semibold">{plan.lesson_period}. ders</span>
                          </div>
                        )}
                        {plan.teacher_name && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">👤</span>
                            <span className="text-sm text-blue-100 truncate">{plan.teacher_name}</span>
                          </div>
                        )}
                      </>
                    )}

                    {/* Planlanmadı */}
                    {plan.status === 'unplanned' && (
                      <div className="flex items-center gap-1.5">
                        <CircleDashed className="h-5 w-5 text-amber-400" />
                        <span className="text-base text-amber-600 font-semibold">Planlanmadı</span>
                      </div>
                    )}
                    </div>
                  </div>

                  {/* Silme Butonu — Sağ Üst Köşe */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeletePlan(plan)
                    }}
                    className={`absolute top-2 right-2 p-2 rounded-lg transition-all opacity-0 group-hover:opacity-100 ${
                      plan.status === 'unplanned'
                        ? 'hover:bg-red-100 text-red-500'
                        : 'hover:bg-white/20 text-white'
                    }`}
                    title="Bu kartı sil"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )
      })}

        </div>
      )}

      {/* Yeni Konu Modalı */}
      {showNewTopicModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">Yeni Konu Oluştur</h3>
              <button onClick={() => setShowNewTopicModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Konu Başlığı</label>
                <input
                  type="text"
                  value={newTopicTitle}
                  onChange={e => setNewTopicTitle(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreateTopic()}
                  placeholder="örn: Verimli Ders Çalışma"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Hangi Kademeler?</label>
                <div className="grid grid-cols-4 gap-2">
                  {[5, 6, 7, 8].map(grade => (
                    <button
                      key={grade}
                      onClick={() => toggleGrade(grade)}
                      className={`py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                        newTopicGrades.includes(grade)
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-300'
                      }`}
                    >
                      {grade}. Sınıf
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Okul Yılı</label>
                <select
                  value={newTopicYear}
                  onChange={e => setNewTopicYear(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  {['2022-2023','2023-2024','2024-2025','2025-2026','2026-2027'].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button
                onClick={() => { setShowNewTopicModal(false); setNewTopicTitle(""); setNewTopicGrades([]) }}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                İptal
              </button>
              <button
                onClick={handleCreateTopic}
                disabled={!newTopicTitle.trim() || newTopicGrades.length === 0 || creating}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:from-emerald-600 hover:to-teal-700 transition-all"
              >
                {creating ? 'Oluşturuluyor...' : 'Oluştur'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Plan Modalı */}
      {showPlanModal && selectedPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">{selectedPlan.class_display} — Plan</h3>
              <button onClick={() => setShowPlanModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              {selectedPlan?.status === 'completed' ? (
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                    <CheckCircle2 className="h-9 w-9 text-emerald-500" />
                  </div>
                  <p className="text-base font-bold text-slate-700">Bu ders tamamlandı</p>
                  {selectedPlan.plan_date && (
                    <p className="text-sm text-slate-500">{formatDateTR(selectedPlan.plan_date)} — {selectedPlan.lesson_period}. ders</p>
                  )}
                  <p className="text-xs text-slate-400 text-center">Geri almak için aşağıdaki butona basın. Kart yeniden planlanmadı durumuna döner.</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Tarih</label>
                    <input
                      type="date"
                      value={planDate}
                      onChange={e => {
                        setPlanDate(e.target.value)
                        if (planPeriod) checkConflict(e.target.value, planPeriod)
                      }}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Ders Saati</label>
                    <div className="grid grid-cols-7 gap-1.5">
                      {[1,2,3,4,5,6,7].map(p => (
                        <button
                          key={p}
                          onClick={() => {
                            setPlanPeriod(p)
                            if (planDate) checkConflict(planDate, p)
                          }}
                          className={`py-2 rounded-lg text-sm font-bold border-2 transition-all ${
                            planPeriod === p
                              ? 'bg-blue-500 border-blue-500 text-white'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300'
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Öğretmen Adı <span className="text-slate-400 font-normal">(isteğe bağlı)</span></label>
                    <input
                      type="text"
                      value={planTeacher}
                      onChange={e => setPlanTeacher(e.target.value)}
                      placeholder="örn: Ahmet Yılmaz"
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  {conflictWarning && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                      <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                      <span className="text-sm text-red-600 font-medium">{conflictWarning}</span>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="flex flex-col gap-2 px-6 pb-6">
              {selectedPlan?.status !== 'completed' && (
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowPlanModal(false)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Kapat
                  </button>
                  <button
                    onClick={handleSavePlan}
                    disabled={!planDate || !planPeriod || !!conflictWarning || savingPlan}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:from-blue-600 hover:to-indigo-700 transition-all"
                  >
                    {savingPlan ? 'Kaydediliyor...' : 'Kaydet'}
                  </button>
                </div>
              )}
              {selectedPlan?.status === 'planned' && (
                <div className="flex gap-3">
                  <button
                    onClick={() => { handleCancelPlan(selectedPlan); setShowPlanModal(false) }}
                    className="flex-1 py-2.5 rounded-xl border border-red-200 text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors"
                  >
                    Planı İptal Et
                  </button>
                  <button
                    onClick={() => { handleCompletePlan(selectedPlan); setShowPlanModal(false) }}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-semibold hover:from-emerald-600 hover:to-teal-700 transition-all"
                  >
                    Tamamlandı ✓
                  </button>
                </div>
              )}
              {selectedPlan?.status === 'completed' && (
                <>
                  <button
                    onClick={() => { handleCancelPlan(selectedPlan); setShowPlanModal(false) }}
                    className="w-full py-2.5 rounded-xl border-2 border-amber-300 text-sm font-semibold text-amber-600 hover:bg-amber-50 transition-colors"
                  >
                    🔄 Geri Al — Yeniden Planla
                  </button>
                  <button
                    onClick={() => handleDeletePlan(selectedPlan)}
                    className="w-full py-2.5 rounded-xl border border-red-300 text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Kartı Sil
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Kademe Yönetimi Modalı */}
      {showGradeManagementModal && selectedTopicForGrades && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">Kademeler — {selectedTopicForGrades.title}</h3>
              <button onClick={() => setShowGradeManagementModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Hangi Kademeler?</label>
                <p className="text-xs text-slate-500 mb-3">Seçili olanlar konuya eklenecek, seçilmeyenler silinecek</p>
                <div className="grid grid-cols-4 gap-2">
                  {[5, 6, 7, 8].map(grade => (
                    <button
                      key={grade}
                      onClick={() => toggleManagedGrade(grade)}
                      className={`py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                        managedGrades.includes(grade)
                          ? 'bg-blue-500 border-blue-500 text-white'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300'
                      }`}
                    >
                      {grade}
                    </button>
                  ))}
                </div>
              </div>
              {managedGrades.length === 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-700 font-medium">⚠️ En az bir kademe seçmelisiniz</p>
                </div>
              )}
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button
                onClick={() => setShowGradeManagementModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                İptal
              </button>
              <button
                onClick={handleSaveGrades}
                disabled={managedGrades.length === 0 || savingGrades}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:from-blue-600 hover:to-indigo-700 transition-all"
              >
                {savingGrades ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
