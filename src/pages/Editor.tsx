import { useState, useEffect, useCallback, lazy, Suspense, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import SimplifiedCKEditor from "@/components/SimplifiedCKEditor";
import CoverPreview from "@/components/CoverPreview";
import { coverTemplates, CoverTemplate } from "@/components/templates/covers";
import { ArrowLeft, Save, Download, FileText, ImageIcon } from "lucide-react";
import { exportToPDF, exportToDOCX } from "@/services/exportService";
import ExportPreviewDialog from "@/components/ExportPreviewDialog";

const PagedPreview = lazy(() => import("@/components/PagedPreview"));

interface Ebook {
  id: string;
  title: string;
  description: string;
  cover_image: string | null;
  template_id: string | null;
  author: string | null;
  genre: string | null;
  price: number;
}

export default function Editor() {
  const [searchParams] = useSearchParams();
  const ebookId = searchParams.get("id");
  const navigate = useNavigate();
  const { toast } = useToast();

  const [ebook, setEbook] = useState<Ebook | null>(null);
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("edit");
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [coverImagePreview, setCoverImagePreview] = useState<string | null>(null);
  const [selectedCoverTemplate, setSelectedCoverTemplate] = useState<CoverTemplate>('classic');

  const getErrorMessage = (error: unknown) => {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    try {
      return JSON.stringify(error) || 'Erro desconhecido';
    } catch {
      return 'Erro desconhecido';
    }
  };

  const loadEbook = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      const { data: ebookData, error: ebookError } = await supabase.from("ebooks").select("*").eq("id", ebookId).single();
      if (ebookError) throw ebookError;
      setEbook(ebookData);
      setCoverImagePreview(ebookData.cover_image);
      
      const { data: chaptersData, error: chaptersError } = await supabase.from("chapters").select("*").eq("ebook_id", ebookId).order("chapter_order", { ascending: true });
      if (chaptersError) throw chaptersError;
      if (chaptersData && chaptersData.length > 0) {
        setContent(chaptersData[0].content || "");
      } else {
        setContent("");
      }
    } catch (error: unknown) {
      toast({ title: "Erro ao carregar ebook", description: getErrorMessage(error), variant: "destructive" });
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  }, [ebookId, navigate, toast]);

  useEffect(() => {
    if (!ebookId) {
      navigate("/dashboard");
      return;
    }
    loadEbook();
  }, [ebookId, loadEbook, navigate]);

  const handleSave = async () => {
    if (!ebook) return;
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      let coverImageUrl = ebook.cover_image;
      if (coverImage) {
        const fileExt = coverImage.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${session.user.id}/${fileName}`;
        const { error: uploadError } = await supabase.storage.from('ebook-covers').upload(filePath, coverImage);
        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage.from('ebook-covers').getPublicUrl(filePath);
          coverImageUrl = publicUrl;
        }
      }

      const { error: ebookError } = await supabase.from("ebooks").update({
        title: ebook.title,
        description: ebook.description,
        pages: 1,
        cover_image: coverImageUrl,
        author: ebook.author,
        genre: ebook.genre,
        price: ebook.price
      }).eq("id", ebook.id);
      if (ebookError) throw ebookError;

      const { error: deleteError } = await supabase.from("chapters").delete().eq("ebook_id", ebook.id);
      if (deleteError) throw deleteError;
      
      const { error: chaptersError } = await supabase.from("chapters").insert({
        ebook_id: ebook.id,
        title: ebook.title,
        content: content,
        chapter_order: 0
      });
      if (chaptersError) throw chaptersError;

      toast({ title: "Salvo com sucesso!", description: "Seu ebook foi salvo." });
      await loadEbook();
    } catch (error: unknown) {
      toast({ title: "Erro ao salvar", description: getErrorMessage(error), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!ebook) return;
    try {
      // Use the hidden export cover element
      const coverEl = document.querySelector('.export-cover-container') as HTMLElement | null;
      await exportToPDF({
        title: ebook.title,
        author: ebook.author,
        content,
        coverElement: coverEl,
        hasCoverPage: true
      });
      toast({ title: "PDF gerado!", description: "O download foi iniciado." });
    } catch (error: unknown) {
      toast({ title: "Erro ao gerar PDF", description: getErrorMessage(error), variant: "destructive" });
    }
  };

  const handleDownloadDOCX = async () => {
    if (!ebook) return;
    try {
      // Use the hidden export cover element
      const coverEl = document.querySelector('.export-cover-container') as HTMLElement | null;
      await exportToDOCX({
        title: ebook.title,
        author: ebook.author,
        content,
        coverElement: coverEl,
        hasCoverPage: true
      });
      toast({ title: "DOCX gerado!", description: "O download foi iniciado." });
    } catch (error: unknown) {
      toast({ title: "Erro ao gerar DOCX", description: getErrorMessage(error), variant: "destructive" });
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando editor...</p>
        </div>
      </div>
    );
  }

  if (!ebook) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Hidden cover for export - always rendered at full size */}
      <div 
        className="export-cover-container"
        style={{
          position: 'absolute',
          left: '-9999px',
          top: 0,
          width: '8.5in',
          height: '11in',
          overflow: 'hidden',
          backgroundColor: '#ffffff'
        }}
      >
        <CoverPreview 
          template={selectedCoverTemplate} 
          title={ebook.title} 
          author={ebook.author} 
          coverImage={coverImagePreview} 
          genre={ebook.genre} 
        />
      </div>
      
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}><ArrowLeft className="h-5 w-5" /></Button>
              <p className="text-sm text-muted-foreground">Editor de Ebook</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={handleSave} disabled={saving}><Save className="h-4 w-4 mr-2" />{saving ? "Salvando..." : "Salvar"}</Button>
              <Button variant="outline" size="sm" onClick={() => setActiveTab(activeTab === "edit" ? "preview" : "edit")}>{activeTab === "edit" ? "Visualizar" : "Editar"}</Button>
              <ExportPreviewDialog
                title={ebook.title}
                author={ebook.author}
                content={content}
                coverTemplate={selectedCoverTemplate}
                coverImage={coverImagePreview}
                genre={ebook.genre}
                onDownloadPDF={handleDownloadPDF}
                onDownloadDOCX={handleDownloadDOCX}
              />
              <Button size="sm" onClick={handleDownloadPDF}><Download className="h-4 w-4 mr-2" />PDF</Button>
              <Button size="sm" onClick={handleDownloadDOCX} variant="secondary"><Download className="h-4 w-4 mr-2" />DOCX</Button>
            </div>
          </div>
        </div>
      </header>

      <div className="a4-editor-wrapper">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="px-8">
            <TabsList className="grid w-full max-w-xs grid-cols-2 mb-6">
              <TabsTrigger value="edit"><FileText className="h-4 w-4 mr-2" />Editar</TabsTrigger>
              <TabsTrigger value="preview">Visualizar</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="edit" className="mt-0 flex justify-center w-full">
            <div className="a4-editor-content">
              <div className="mb-4 p-4 bg-card border rounded-lg shadow-sm">
                <div className="flex items-center gap-4 flex-wrap">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-2"><ImageIcon className="h-4 w-4" />Template da Capa:</span>
                  <div className="flex gap-2 flex-wrap">
                    {coverTemplates.map((template) => (
                      <Button key={template.id} variant={selectedCoverTemplate === template.id ? "default" : "outline"} size="sm" onClick={() => setSelectedCoverTemplate(template.id)}>{template.name}</Button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-sm text-muted-foreground mb-2 text-center">Capa do Ebook</p>
                <div style={{ transform: 'scale(0.5)', transformOrigin: 'top center', marginBottom: '-5.5in' }}>
                  <CoverPreview template={selectedCoverTemplate} title={ebook.title} author={ebook.author} coverImage={coverImagePreview} genre={ebook.genre} />
                </div>
              </div>
              
              <div className="a4-page">
                <div className="page-content">
                  <div style={{ marginBottom: '16pt' }}>
                    <Input value={ebook.title} onChange={e => setEbook({ ...ebook, title: e.target.value })} placeholder="Título do ebook" className="text-2xl font-bold border-none shadow-none p-0 h-auto focus-visible:ring-0" style={{ fontSize: '24pt', fontFamily: "'Calibri', sans-serif", background: 'transparent' }} />
                  </div>
                  {ebook.author && <div style={{ marginBottom: '16pt', color: '#666', fontSize: '12pt' }}>por {ebook.author}</div>}
                  <div className="editor-area" style={{ flex: 1, minHeight: '600px' }}>
                    <SimplifiedCKEditor value={content} onChange={setContent} />
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="preview" className="mt-0 w-full">
            <Suspense fallback={<div className="flex items-center justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
              <div className="paged-preview-container">
                <div className="cover-preview-wrapper" style={{ marginBottom: '2rem' }}>
                  <CoverPreview template={selectedCoverTemplate} title={ebook.title} author={ebook.author} coverImage={coverImagePreview} genre={ebook.genre} />
                </div>
                <PagedPreview title={ebook.title} author={ebook.author} description={ebook.description || ''} content={content} coverImage={null} />
              </div>
            </Suspense>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
