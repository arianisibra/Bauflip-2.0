"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ArticleCategoryTemplateScope } from "@/lib/domain/types";

const templateScopeLabel: Record<ArticleCategoryTemplateScope, string> = {
  generic: "Allgemein",
  storen: "Storen",
  sonnenstoren: "Sonnenstoren",
  dl: "Dienstleistung",
};

const scopes = Object.keys(templateScopeLabel) as ArticleCategoryTemplateScope[];

export function ArticleTemplateScopeSelect() {
  const [scope, setScope] = useState<ArticleCategoryTemplateScope>("generic");

  return (
    <>
      <input type="hidden" name="templateScope" value={scope} />
      <Select value={scope} onValueChange={(v) => setScope(v as ArticleCategoryTemplateScope)}>
        <SelectTrigger id="templateScope" className="h-9 w-full min-w-0 sm:w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {scopes.map((key) => (
            <SelectItem key={key} value={key}>
              {templateScopeLabel[key]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}
