import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

interface MermaidRendererProps {
    code: string;
    className?: string;
}

// Generate unique ID counter
let mermaidIdCounter = 0;

const MermaidRenderer = ({ code, className = '' }: MermaidRendererProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [svgContent, setSvgContent] = useState<string>('');
    const [isRendering, setIsRendering] = useState(false);

    useEffect(() => {
        // Initialize mermaid once
        mermaid.initialize({
            startOnLoad: false,
            theme: 'dark',
            themeVariables: {
                darkMode: true,
                primaryColor: '#6366F1',
                primaryTextColor: '#F4F6FF',
                primaryBorderColor: '#6366F1',
                lineColor: '#64748B',
                secondaryColor: '#1E293B',
                tertiaryColor: '#0F172A',
                background: '#0B0D14',
                mainBkg: '#1E293B',
                nodeBorder: '#6366F1',
                clusterBkg: 'rgba(99, 102, 241, 0.1)',
                clusterBorder: '#6366F1',
                titleColor: '#F4F6FF',
                edgeLabelBackground: '#1E293B',
            },
            flowchart: {
                curve: 'basis',
                padding: 20,
            },
            securityLevel: 'loose',
        });
    }, []);

    useEffect(() => {
        const renderDiagram = async () => {
            if (!code) {
                setSvgContent('');
                return;
            }

            setIsRendering(true);
            setError(null);

            try {
                // Clean the code - remove markdown code blocks if present
                let cleanCode = code.trim();
                if (cleanCode.startsWith('```mermaid')) {
                    cleanCode = cleanCode.replace(/^```mermaid\n/, '').replace(/\n```$/, '');
                } else if (cleanCode.startsWith('```')) {
                    cleanCode = cleanCode.replace(/^```\n/, '').replace(/\n```$/, '');
                }

                // Generate unique ID
                mermaidIdCounter += 1;
                const id = `mermaid-${mermaidIdCounter}-${Date.now()}`;

                console.log('Rendering mermaid diagram:', { id, codeLength: cleanCode.length });

                // Parse and render
                const { svg } = await mermaid.render(id, cleanCode);
                console.log('Mermaid render successful, SVG length:', svg.length);
                setSvgContent(svg);
            } catch (err: any) {
                console.error('Mermaid render error:', err);
                setError(err.message || 'Failed to render diagram');
                setSvgContent('');
            } finally {
                setIsRendering(false);
            }
        };

        // Debounce rendering
        const timeoutId = setTimeout(renderDiagram, 100);
        return () => clearTimeout(timeoutId);
    }, [code]);

    if (error) {
        return (
            <div className={`flex flex-col items-center justify-center p-8 bg-red-500/10 border border-red-500/30 rounded-xl ${className}`}>
                <p className="text-red-400 text-sm mb-2">Failed to render diagram</p>
                <p className="text-red-400/70 text-xs font-mono max-w-full overflow-auto">{error}</p>
            </div>
        );
    }

    if (isRendering || !svgContent) {
        return (
            <div className={`flex flex-col items-center justify-center p-8 bg-[rgba(244,246,255,0.02)] rounded-xl ${className}`}>
                <div className="w-8 h-8 border-2 border-[#6366F1]/30 border-t-[#6366F1] rounded-full animate-spin mb-2" />
                <p className="text-xs text-[#64748B]">Rendering diagram...</p>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className={`mermaid-container overflow-auto ${className}`}
            dangerouslySetInnerHTML={{ __html: svgContent }}
            style={{
                minHeight: '200px',
            }}
        />
    );
};

export default MermaidRenderer;
