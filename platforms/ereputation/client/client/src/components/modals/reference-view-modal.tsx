import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ReferenceViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reference: any;
}

export default function ReferenceViewModal({ open, onOpenChange, reference }: ReferenceViewModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full h-screen sm:h-auto sm:max-w-lg mx-0 sm:mx-4 bg-fig-10 border-0 sm:border-2 border-fig/20 shadow-2xl rounded-none sm:rounded-xl p-4 sm:p-6">
        <DialogHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-fig rounded-2xl flex items-center justify-center mb-3 transform rotate-12">
            <svg className="w-6 h-6 text-swiss-cheese transform -rotate-12" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
          </div>
          <DialogTitle className="text-lg sm:text-xl font-black text-fig">
            eReference {reference?.type === 'Sent' ? 'for' : 'from'} {reference?.forFrom}
          </DialogTitle>
          <DialogDescription className="text-fig/70 text-sm font-medium mt-2">
            Professional reference details and status
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 mt-6 flex-1 overflow-y-auto">
          {/* Reference Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-4 border-2 border-fig/20 rounded-xl bg-fig-10">
              <div className="text-xs font-black text-fig mb-1">Type</div>
              <div className="text-sm text-fig/80 font-medium">{reference?.type}</div>
            </div>
            <div className="p-4 border-2 border-fig/20 rounded-xl bg-fig-10">
              <div className="text-xs font-black text-fig mb-1">Date</div>
              <div className="text-sm text-fig/80 font-medium">{reference?.date}</div>
            </div>
          </div>
          
          {/* Status */}
          <div className="p-4 border-2 border-fig/20 rounded-xl bg-fig-10">
            <div className="text-xs font-black text-fig mb-2">Status</div>
            <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-black bg-white border-2 w-20 h-7"
                 style={{
                   borderColor: reference?.status === 'Signed' ? '#22c55e' : '#ef4444',
                   backgroundColor: reference?.status === 'Signed' ? '#f0fdf4' : '#fef2f2',
                   color: reference?.status === 'Signed' ? '#15803d' : '#dc2626'
                 }}>
              {reference?.status?.toLowerCase()}
            </span>
          </div>
          
          {/* Reference Content */}
          <div className="p-4 border-2 border-fig/20 rounded-xl bg-fig-10 min-h-[120px]">
            <div className="text-xs font-black text-fig mb-2">Reference Details</div>
            <div className="text-sm text-fig/80 font-medium leading-relaxed">
              {reference?.content || 'Reference content not available'}
            </div>
          </div>

          {/* Digital Signature Info */}
          {reference?.id && String(reference.id).startsWith('ref_') && (
            <div className="p-4 border-2 border-fig/20 rounded-xl bg-fig-10">
              <div className="text-xs font-black text-fig mb-2">Digital Signature</div>
              <div className="text-xs text-fig/60 font-medium">
                This reference has been digitally signed for authenticity verification.
              </div>
            </div>
          )}
        </div>
        
        <div className="flex justify-end mt-6 pt-4 border-t border-fig/10">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="border-2 border-fig/30 text-fig/70 hover:bg-fig-10 hover:border-fig/40 font-bold h-11 px-8"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}