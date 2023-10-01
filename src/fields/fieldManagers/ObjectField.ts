import MetadataMenu from "main";
import { FieldIcon, FieldType } from "src/types/fieldTypes";

import { FieldManager, SettingLocation } from "../FieldManager";
import Field from "../Field";
import { TFile, Menu } from "obsidian";
import NoteFieldsComponent, { FieldOptions } from "src/components/NoteFields";
import FieldCommandSuggestModal from "src/options/FieldCommandSuggestModal";
import { postValues } from "src/commands/postValues";
import { Note } from "src/note/note";
import ObjectModal from "src/modals/fields/ObjectModal";

export default class ObjectField extends FieldManager {

    constructor(plugin: MetadataMenu, field: Field) {
        super(plugin, field, FieldType.Object)
    }

    addFieldOption(file: TFile, location: Menu | FieldCommandSuggestModal | FieldOptions, indexedPath?: string, noteField?: NoteFieldsComponent): void {
        if (noteField) {
            const action = async () => await noteField.moveToObject(`${indexedPath}`);
            if (ObjectField.isFieldOptions(location)) {
                location.addOption(FieldIcon[FieldType.Object], action, `Go to ${this.field.name}'s fields`);
            }
        } else {
            const name = this.field.name
            const action = () => { }
            if (ObjectField.isMenu(location)) {
                location.addItem((item) => {
                    item.setTitle(`Update <${name}>`);
                    item.setIcon(FieldIcon[FieldType.Object]);
                    item.onClick(action);
                    item.setSection("metadata-menu.fields");
                });
            } else if (ObjectField.isSuggest(location)) {
                location.options.push({
                    id: `update_${name}`,
                    actionLabel: `<span>Update <b>${name}</b></span>`,
                    action: action,
                    icon: FieldIcon[FieldType.Object]
                });
            }
        }
    }
    validateOptions(): boolean {
        return true
    }
    createSettingContainer(parentContainer: HTMLDivElement, plugin: MetadataMenu, location?: SettingLocation): void {

    }
    createDvField(dv: any, p: any, fieldContainer: HTMLElement, attrs?: { cls?: string | undefined; attr?: Record<string, string> | undefined; options?: Record<string, string> | undefined; }): void {
        const fieldValue = dv.el('span', "{...}", attrs);
        fieldContainer.appendChild(fieldValue);
    }
    getOptionsStr(): string {
        return ""
    }
    async createAndOpenFieldModal(file: TFile, selectedFieldName: string, note?: Note,
        indexedPath?: string, lineNumber?: number, after?: boolean, asList?: boolean, asComment?: boolean): Promise<void> {
        const fieldModal = new ObjectModal(this.plugin, file, note, indexedPath, lineNumber, after, asList, asComment)
        fieldModal.open();
    }
    public displayValue(container: HTMLDivElement, file: TFile, value: any, onClicked?: () => void): void {
        const fields = this.plugin.fieldIndex.filesFields.get(file.path)
        container.setText(`${fields?.filter(_f => _f.path === this.field.id).map(_f => _f.name)}`)
    }

}