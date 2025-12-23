import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, Download, FileText } from "lucide-react";
import CoverPreview from "./CoverPreview";
import { CoverTemplate } from "./templates/covers";
import RichTextViewer from "./RichTextViewer";

interface ExportPreviewDialogProps {
  title: string;
  author: string | null;
  content: string;
  coverTemplate: CoverTemplate;
  coverImage: string | null;
  genre: string | null;
  onDownloadPDF: () => void;
  onDownloadDOCX: () => void;
}

export default function ExportPreviewDialog({
  title,
  author,
  content,
  coverTemplate,
  coverImage,
  genre,
  onDownloadPDF,
  onDownloadDOCX
}: ExportPreviewDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Eye className="h-4 w-4 mr-2" />
          Prévia
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Prévia de Exportação</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="cover" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="cover">Capa</TabsTrigger>
            <TabsTrigger value="content">Conteúdo</TabsTrigger>
          </TabsList>
          
          <TabsContent value="cover" className="flex-1 overflow-auto mt-4">
            <div className="flex justify-center">
              <div className="border shadow-lg" style={{ width: '4.25in', height: '5.5in', overflow: 'hidden' }}>
                <div style={{ transform: 'scale(0.5)', transformOrigin: 'top left', width: '8.5in', height: '11in' }}>
                  <CoverPreview
                    template={coverTemplate}
                    title={title}
                    author={author}
                    coverImage={coverImage}
                    genre={genre}
                  />
                </div>
              </div>
            </div>
            <p className="text-center text-sm text-muted-foreground mt-4">
              A capa ocupará a página inteira no arquivo exportado
            </p>
          </TabsContent>
          
          <TabsContent value="content" className="flex-1 overflow-auto mt-4">
            <div className="bg-white border shadow-lg mx-auto p-8" style={{ maxWidth: '8.5in', minHeight: '11in' }}>
              <h1 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Calibri, sans-serif' }}>{title}</h1>
              {author && <p className="text-muted-foreground mb-6">por {author}</p>}
              <div className="prose prose-sm max-w-none">
                <RichTextViewer html={content} />
              </div>
            </div>
          </TabsContent>
        </Tabs>
        
        <div className="flex gap-2 justify-end pt-4 border-t">
          <Button onClick={onDownloadPDF}>
            <Download className="h-4 w-4 mr-2" />
            Baixar PDF
          </Button>
          <Button onClick={onDownloadDOCX} variant="secondary">
            <FileText className="h-4 w-4 mr-2" />
            Baixar DOCX
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
