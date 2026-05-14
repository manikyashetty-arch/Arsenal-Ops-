import React from 'react';
import { Plus, Pencil, Trash2, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CustomRestriction {
  id: number;
  name: string;
  tab_name: string;
  subsection: string;
  created_at: string;
}

interface CustomRestrictionsTabProps {
  customRestrictions: CustomRestriction[];
  handleCreateRestriction: () => void;
  handleEditRestriction: (restriction: CustomRestriction) => void;
  handleDeleteRestriction: (id: number) => void;
  toPascalCase: (str: string) => string;
}

const CustomRestrictionsTab: React.FC<CustomRestrictionsTabProps> = ({
  customRestrictions,
  handleCreateRestriction,
  handleEditRestriction,
  handleDeleteRestriction,
  toPascalCase,
}) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">
          Custom Restrictions Management
        </h2>
        <Button
          onClick={handleCreateRestriction}
          className="bg-gradient-to-r from-[#E0B954] to-[#B8872A] hover:from-[#C79E3B] hover:to-[#B8872A] text-white rounded-xl h-10 px-4"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Restriction
        </Button>
      </div>
      <div className="bg-[#0d0d0d] border border-[rgba(255,255,255,0.05)] rounded-xl overflow-visible">
        <table className="w-full">
          <thead className="bg-[rgba(255,255,255,0.02)]">
            <tr>
              <th className="text-left text-xs font-medium text-[#737373] py-3 px-4">
                Name
              </th>
              <th className="text-left text-xs font-medium text-[#737373] py-3 px-4">
                Tab
              </th>
              <th className="text-left text-xs font-medium text-[#737373] py-3 px-4">
                Subsection
              </th>
              <th className="text-left text-xs font-medium text-[#737373] py-3 px-4">
                Created
              </th>
              <th className="text-right text-xs font-medium text-[#737373] py-3 px-4">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[rgba(255,255,255,0.03)]">
            {customRestrictions.map((restriction) => (
              <tr key={restriction.id} className="hover:bg-[rgba(255,255,255,0.02)]">
                <td className="py-3 px-4">
                  <span className="inline-flex items-center gap-2 px-2 py-1 rounded text-xs bg-[#E0B954]/20 text-[#E0B954]">
                    <Shield className="w-3 h-3" />
                    {restriction.name}
                  </span>
                </td>
                <td className="py-3 px-4 text-sm text-[#a3a3a3]">
                  {toPascalCase(restriction.tab_name)}
                </td>
                <td className="py-3 px-4 text-sm text-[#a3a3a3]">
                  {restriction.subsection}
                </td>
                <td className="py-3 px-4 text-sm text-[#737373]">
                  {new Date(restriction.created_at).toLocaleDateString()}
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditRestriction(restriction)}
                      className="text-[#737373] hover:text-red-400 h-8"
                    >
                      <Pencil className="w-3.5 h-3.5 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteRestriction(restriction.id)}
                      className="text-[#737373] hover:text-red-400 h-8"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {customRestrictions.length === 0 && (
          <div className="text-center py-12 text-[#737373]">
            No custom restrictions yet. Click "Add Restriction" to create one.
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomRestrictionsTab;
