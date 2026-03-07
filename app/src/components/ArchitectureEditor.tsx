import { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { X, Save, RotateCcw, Maximize2, Minimize2, Sparkles, Send, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import MermaidRenderer from './MermaidRenderer';
import { toast } from 'sonner';

import { API_BASE_URL } from '@/config/api';

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

interface ArchitectureEditorProps {
    architecture: Architecture;
    onSave: (id: number, updates: { mermaid_code?: string; name?: string; description?: string }) => void;
    onClose: () => void;
}

const ArchitectureEditor = ({ architecture, onSave, onClose }: ArchitectureEditorProps) => {
    const [code, setCode] = useState(architecture.mermaid_code);
    const [name, setName] = useState(architecture.name);
    const [description, setDescription] = useState(architecture.description);
    const [originalCode] = useState(architecture.mermaid_code);
    const [isFullScreen, setIsFullScreen] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    
    // AI Refine state
    const [changeInstructions, setChangeInstructions] = useState('');
    const [isRefining, setIsRefining] = useState(false);
    const [changesApplied, setChangesApplied] = useState<string[]>([]);
    const [aiNotes, setAiNotes] = useState('');

    const hasChanges = code !== originalCode || name !== architecture.name || description !== architecture.description;

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSave(architecture.id, { mermaid_code: code, name, description });
        } finally {
            setIsSaving(false);
        }
    };

    const handleReset = () => {
        setCode(originalCode);
        setName(architecture.name);
        setDescription(architecture.description);
        setChangesApplied([]);
        setAiNotes('');
    };
    
    // AI Refine - send plain English instructions to AI
    const handleAIRefine = async () => {
        if (!changeInstructions.trim()) {
            toast.error('Please describe the changes you want to make');
            return;
        }
        
        setIsRefining(true);
        setChangesApplied([]);
        setAiNotes('');
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/prd/architectures/${architecture.id}/ai-refine`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    current_mermaid_code: code,
                    change_instructions: changeInstructions
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                setCode(data.architecture.mermaid_code);
                if (data.architecture.description) {
                    setDescription(data.architecture.description);
                }
                setChangesApplied(data.changes_applied || []);
                setAiNotes(data.ai_notes || '');
                setChangeInstructions('');
                toast.success('Architecture updated with AI!');
            } else {
                const error = await response.json();
                toast.error(error.detail || 'Failed to refine architecture');
            }
        } catch (err) {
            toast.error('Failed to connect to AI service');
        } finally {
            setIsRefining(false);
        }
    };

    // Handle escape key
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-50 bg-[#05060B] flex flex-col">
            {/* Header */}
            <div className="h-14 border-b border-[rgba(244,246,255,0.08)] bg-[#0B0D14] flex items-center justify-between px-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-[rgba(244,246,255,0.05)] text-[#64748B] hover:text-white"
                    >
                        <X className="w-5 h-5" />
                    </button>
                    <div className="w-px h-6 bg-[rgba(244,246,255,0.08)]" />
                    <div className="flex items-center gap-3">
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="bg-transparent border-none text-lg font-semibold text-white h-9 w-64 focus:ring-0"
                            placeholder="Architecture Name"
                        />
                        <span className="text-xs text-[#64748B] capitalize px-2 py-1 rounded bg-[rgba(244,246,255,0.05)]">
                            {architecture.architecture_type}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {hasChanges && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleReset}
                            className="text-[#64748B] hover:text-white"
                        >
                            <RotateCcw className="w-4 h-4 mr-2" />
                            Reset
                        </Button>
                    )}
                    <Button
                        onClick={handleSave}
                        disabled={!hasChanges || isSaving}
                        className="bg-[#6366F1] hover:bg-[#5558E6] text-white"
                    >
                        {isSaving ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4 mr-2" />
                                Save Changes
                            </>
                        )}
                    </Button>
                </div>
            </div>

            {/* Description */}
            <div className="h-12 border-b border-[rgba(244,246,255,0.06)] bg-[#0B0D14]/50 flex items-center px-4">
                <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="bg-transparent border-none text-sm text-[#94A3B8] h-8 w-full focus:ring-0"
                    placeholder="Architecture description..."
                />
            </div>

            {/* AI Refine Panel */}
            <div className="border-b border-[rgba(244,246,255,0.06)] bg-gradient-to-r from-[#6366F1]/5 to-transparent">
                <div className="px-4 py-3">
                    <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-4 h-4 text-[#6366F1]" />
                        <span className="text-sm font-medium text-white">AI Architecture Refine</span>
                        <span className="text-xs text-[#64748B]">Describe changes in plain English</span>
                    </div>
                    <div className="flex gap-3">
                        <div className="flex-1">
                            <Textarea
                                value={changeInstructions}
                                onChange={(e) => setChangeInstructions(e.target.value)}
                                placeholder="e.g., Add a Redis cache between API and database, Replace MySQL with PostgreSQL, Add a load balancer, Include message queue for async processing..."
                                className="bg-[rgba(244,246,255,0.03)] border-[rgba(244,246,255,0.1)] text-[#F4F6FF] rounded-lg min-h-[60px] max-h-[80px] text-sm placeholder:text-[#475569] resize-none"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                        e.preventDefault();
                                        handleAIRefine();
                                    }
                                }}
                            />
                        </div>
                        <Button
                            onClick={handleAIRefine}
                            disabled={isRefining || !changeInstructions.trim()}
                            className="bg-gradient-to-r from-[#6366F1] to-[#4F46E5] hover:from-[#5558E6] hover:to-[#4338CA] text-white h-[60px] px-6 self-start"
                        >
                            {isRefining ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                                    Refining...
                                </>
                            ) : (
                                <>
                                    <Send className="w-4 h-4 mr-2" />
                                    Refine
                                </>
                            )}
                        </Button>
                    </div>
                    <p className="text-[10px] text-[#475569] mt-1">Press Cmd+Enter or Ctrl+Enter to submit</p>
                    
                    {/* Changes Applied */}
                    {changesApplied.length > 0 && (
                        <div className="mt-3 p-3 bg-[#10B981]/10 border border-[#10B981]/20 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                                <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                                <span className="text-sm font-medium text-[#10B981]">Changes Applied</span>
                            </div>
                            <ul className="space-y-1">
                                {changesApplied.map((change, i) => (
                                    <li key={i} className="text-xs text-[#94A3B8] flex items-start gap-2">
                                        <span className="text-[#10B981]">+</span>
                                        <span>{change}</span>
                                    </li>
                                ))}
                            </ul>
                            {aiNotes && (
                                <p className="text-xs text-[#64748B] mt-2 italic border-t border-[#10B981]/20 pt-2">
                                    AI Notes: {aiNotes}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Main Content - Split View */}
            <div className="flex flex-1 overflow-hidden">
                {/* Code Editor */}
                <div className="w-1/2 border-r border-[rgba(244,246,255,0.08)] flex flex-col">
                    <div className="h-10 border-b border-[rgba(244,246,255,0.06)] bg-[rgba(244,246,255,0.02)] flex items-center justify-between px-4">
                        <span className="text-xs font-medium text-[#64748B]">Mermaid Code</span>
                        <span className="text-xs text-[#475569]">{code.split('\n').length} lines</span>
                    </div>
                    <div className="flex-1">
                        <Editor
                            height="100%"
                            defaultLanguage="markdown"
                            value={code}
                            onChange={(value) => setCode(value || '')}
                            theme="vs-dark"
                            options={{
                                minimap: { enabled: false },
                                fontSize: 14,
                                lineNumbers: 'on',
                                wordWrap: 'on',
                                scrollBeyondLastLine: false,
                                automaticLayout: true,
                                padding: { top: 16, bottom: 16 },
                                fontFamily: 'JetBrains Mono, Fira Code, monospace',
                            }}
                        />
                    </div>
                </div>

                {/* Preview */}
                <div className="w-1/2 flex flex-col bg-[#0B0D14]">
                    <div className="h-10 border-b border-[rgba(244,246,255,0.06)] bg-[rgba(244,246,255,0.02)] flex items-center justify-between px-4">
                        <span className="text-xs font-medium text-[#64748B]">Preview</span>
                        <button
                            onClick={() => setIsFullScreen(!isFullScreen)}
                            className="p-1 rounded hover:bg-[rgba(244,246,255,0.1)] text-[#64748B] hover:text-white"
                        >
                            {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                        </button>
                    </div>
                    <div className="flex-1 p-6 overflow-auto">
                        <MermaidRenderer code={code} className="w-full h-full" />
                    </div>
                </div>
            </div>

            {/* Info Bar */}
            <div className="h-8 border-t border-[rgba(244,246,255,0.06)] bg-[#0B0D14] flex items-center justify-between px-4 text-xs text-[#475569] flex-shrink-0">
                <div className="flex items-center gap-4">
                    <span>Cost: <span className="text-[#10B981]">{architecture.estimated_cost}</span></span>
                    <span>Complexity: <span className="text-[#F59E0B] capitalize">{architecture.complexity}</span></span>
                    <span>Timeline: <span className="text-[#6366F1]">{architecture.time_to_implement}</span></span>
                </div>
                <div className="flex items-center gap-2">
                    <span>Press <kbd className="px-1.5 py-0.5 bg-[rgba(244,246,255,0.1)] rounded text-[#94A3B8]">Esc</kbd> to close</span>
                </div>
            </div>
        </div>
    );
};

export default ArchitectureEditor;
