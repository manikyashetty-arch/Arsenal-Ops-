import { CheckCircle2, Clock, DollarSign, Maximize2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import MermaidRenderer from './MermaidRenderer';

interface Architecture {
    id: number;
    name: string;
    description: string;
    architecture_type: string;
    mermaid_code: string;
    pros: string[];
    cons: string[];
    estimated_cost: string;
    complexity: string;
    time_to_implement: string;
    is_selected: boolean;
}

interface ArchitectureCardProps {
    architecture: Architecture;
    onSelect: (id: number) => void;
    onViewFullScreen: (architecture: Architecture) => void;
    isSelected?: boolean;
}

const complexityColors = {
    low: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
    medium: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/30' },
    high: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' },
};

const ArchitectureCard = ({ architecture, onSelect, onViewFullScreen, isSelected }: ArchitectureCardProps) => {
    const complexity = complexityColors[architecture.complexity as keyof typeof complexityColors] || complexityColors.medium;
    const isRecommended = architecture.architecture_type === 'recommended';

    return (
        <div
            className={`bg-[rgba(244,246,255,0.02)] border rounded-2xl overflow-hidden transition-all ${
                isSelected
                    ? 'border-[#6366F1] shadow-lg shadow-[#6366F1]/20'
                    : 'border-[rgba(244,246,255,0.06)] hover:border-[rgba(244,246,255,0.12)]'
            }`}
        >
            {/* Header */}
            <div className="p-4 border-b border-[rgba(244,246,255,0.06)]">
                <div className="flex items-start justify-between mb-2">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            {isRecommended && (
                                <Badge className="bg-[#6366F1]/20 text-[#6366F1] border-0 text-xs">
                                    Recommended
                                </Badge>
                            )}
                            {!isRecommended && (
                                <Badge className="bg-[rgba(244,246,255,0.06)] text-[#94A3B8] border-0 text-xs">
                                    Alternative
                                </Badge>
                            )}
                        </div>
                        <h3 className="text-lg font-semibold text-white">{architecture.name}</h3>
                    </div>
                    {isSelected && (
                        <div className="w-8 h-8 rounded-full bg-[#6366F1] flex items-center justify-center">
                            <CheckCircle2 className="w-5 h-5 text-white" />
                        </div>
                    )}
                </div>
                <p className="text-sm text-[#94A3B8] line-clamp-2">{architecture.description}</p>
            </div>

            {/* Mermaid Diagram Preview */}
            <div className="p-4 bg-[#0B0D14] border-b border-[rgba(244,246,255,0.06)] min-h-[200px] max-h-[300px] overflow-hidden relative">
                <MermaidRenderer code={architecture.mermaid_code} className="scale-75 origin-top-left" showControls={false} />
                <button
                    onClick={() => onViewFullScreen(architecture)}
                    className="absolute top-2 right-2 p-2 rounded-lg bg-[rgba(244,246,255,0.1)] hover:bg-[rgba(244,246,255,0.2)] text-[#94A3B8] hover:text-white transition-colors"
                    title="View Full Screen"
                >
                    <Maximize2 className="w-4 h-4" />
                </button>
            </div>

            {/* Stats */}
            <div className="p-4 grid grid-cols-3 gap-3 border-b border-[rgba(244,246,255,0.06)]">
                <div className="text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                        <DollarSign className="w-3.5 h-3.5 text-[#10B981]" />
                        <span className="text-xs text-[#64748B]">Cost</span>
                    </div>
                    <p className="text-sm font-medium text-white">{architecture.estimated_cost}</p>
                </div>
                <div className="text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                        <Zap className="w-3.5 h-3.5 text-[#F59E0B]" />
                        <span className="text-xs text-[#64748B]">Complexity</span>
                    </div>
                    <Badge className={`${complexity.bg} ${complexity.text} border-0 text-xs capitalize`}>
                        {architecture.complexity}
                    </Badge>
                </div>
                <div className="text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                        <Clock className="w-3.5 h-3.5 text-[#6366F1]" />
                        <span className="text-xs text-[#64748B]">Timeline</span>
                    </div>
                    <p className="text-sm font-medium text-white">{architecture.time_to_implement}</p>
                </div>
            </div>

            {/* Pros & Cons */}
            <div className="p-4 grid grid-cols-2 gap-4 border-b border-[rgba(244,246,255,0.06)]">
                <div>
                    <h4 className="text-xs font-medium text-[#10B981] mb-2">Pros</h4>
                    <ul className="space-y-1">
                        {architecture.pros?.slice(0, 3).map((pro, i) => (
                            <li key={i} className="text-xs text-[#94A3B8] flex items-start gap-1.5">
                                <span className="text-[#10B981] mt-0.5">+</span>
                                <span className="line-clamp-1">{pro}</span>
                            </li>
                        ))}
                    </ul>
                </div>
                <div>
                    <h4 className="text-xs font-medium text-[#EF4444] mb-2">Cons</h4>
                    <ul className="space-y-1">
                        {architecture.cons?.slice(0, 3).map((con, i) => (
                            <li key={i} className="text-xs text-[#94A3B8] flex items-start gap-1.5">
                                <span className="text-[#EF4444] mt-0.5">-</span>
                                <span className="line-clamp-1">{con}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            {/* Actions */}
            <div className="p-4 flex gap-2">
                <Button
                    onClick={() => onViewFullScreen(architecture)}
                    className="flex-1 bg-gradient-to-r from-[#475569] to-[#334155] hover:from-[#64748B] hover:to-[#475569] text-white font-medium"
                >
                    <Maximize2 className="w-4 h-4 mr-2" />
                    View & Edit
                </Button>
                <Button
                    onClick={() => onSelect(architecture.id)}
                    className={`flex-1 font-medium shadow-lg ${
                        isSelected
                            ? 'bg-gradient-to-r from-[#6366F1] to-[#4F46E5] text-white shadow-[#4F46E5]/20'
                            : 'bg-gradient-to-r from-[#475569] to-[#334155] text-white hover:from-[#6366F1] hover:to-[#4F46E5] shadow-black/20'
                    }`}
                >
                    {isSelected ? (
                        <>
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            Selected
                        </>
                    ) : (
                        'Select This'
                    )}
                </Button>
            </div>
        </div>
    );
};

export default ArchitectureCard;
