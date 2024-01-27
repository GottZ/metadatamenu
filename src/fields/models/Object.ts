import { ButtonComponent, DropdownComponent, Menu, Notice, TFile, TextAreaComponent, TextComponent, setIcon } from "obsidian"
import { IFieldBase, BaseOptions } from "../base/BaseField"
import { ISettingsModal } from "../base/BaseSetting"
import { getIcon, mapFieldType, displayValue as getDisplayValue, TypesOptionsMap, objectTypes } from "../Fields"
import { IFieldManager, Target, isSingleTargeted, baseDisplayValue, fieldValueManager, isSuggest, isFieldActions, LegacyField, ActionLocation } from "../Field"
import MetadataMenu from "main"
import { IBasicModal, IBasicSuggestModal, basicModal } from "../base/BaseModal"
import { cleanActions } from "src/utils/modals"
import { Constructor, FrontmatterObject } from "src/typings/types"
import { ExistingField, getExistingFieldForIndexedPath, getValueDisplay } from "../ExistingField"
import { Note } from "src/note/note"
import FieldCommandSuggestModal from "src/options/FieldCommandSuggestModal"
import OptionsList from "src/options/OptionsList"
import NoteFieldsComponent from "src/components/FieldsModal"
import * as AbstractObject from "./abstractModels/AbstractObject"
import GField from "src/fields/_Field"
import { getNextOption } from "./Cycle"
import { postValues } from "src/commands/postValues"

export class Base implements IFieldBase {
    type = <const>"Object"
    tagName = "object"
    icon = "package"
    tooltip = "Accepts an object with nested fields"
    colorClass = "lookup"
}

export interface Options extends AbstractObject.Options { }
export interface DefaultedOptions extends Options {
    displayTemplate: string
}
export const DefaultOptions: DefaultedOptions = {
    ...AbstractObject.DefaultOptions,
    displayTemplate: ""
}

export function settingsModal(Base: Constructor<ISettingsModal<AbstractObject.DefaultedOptions>>): Constructor<ISettingsModal<Options>> {
    return AbstractObject.settingsModal(Base)
}

export interface Modal<Target> extends AbstractObject.Modal<Target> {
    existingFields: ExistingField[]
    missingFields: GField[]
}

export function valueModal(managedField: IFieldManager<Target, Options>, plugin: MetadataMenu): Constructor<Modal<Target>> {
    const base = AbstractObject.valueModal(managedField, plugin)
    return class ValueModal extends base {
        public existingFields: ExistingField[] = []
        public missingFields: GField[] = []
        async onOpen() {
            if (this.managedField.indexedPath && isSingleTargeted(this.managedField)) {

                const { existingFields, missingFields } = await AbstractObject.getExistingAndMissingFields(
                    this.managedField.plugin, this.managedField.target, this.managedField.indexedPath)
                this.existingFields = existingFields
                this.missingFields = missingFields

            }
            super.onOpen()
        };

        getSuggestions(query: string = ""): Array<ExistingField | GField> {
            return [...this.existingFields, ...this.missingFields].filter(f => {
                if (f instanceof ExistingField) {
                    return f.field.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())
                } else {
                    return f.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())
                }
            })
        }

        renderSuggestion(item: ExistingField | GField, el: HTMLElement) {
            const container = el.createDiv({ cls: "value-container" })
            if (item instanceof ExistingField) {
                container.createDiv({ text: `${item.field.name} :`, cls: "label-container" })
                const valueContainer = container.createDiv()
                const fieldVM = fieldValueManager(this.managedField.plugin, item.field.id, item.field.fileClassName, item.file, item, item.indexedPath, item.lineNumber)
                fieldVM?.value ? getDisplayValue(mapFieldType(item.field.type))(fieldVM, valueContainer,) : valueContainer.setText("<empty>")
            } else {
                container.createDiv({ text: `${item.name} :`, cls: "label-container" })
                container.createDiv({ text: "<missing>" })
            }

        }

        async onChooseSuggestion(item: ExistingField | GField, evt: MouseEvent | KeyboardEvent) {
            const mF = this.managedField
            if (!isSingleTargeted(mF)) return
            const reOpen = async () => {
                // because vault.on("modify") is not triggered fast enough
                const eF = await Note.getExistingFieldForIndexedPath(mF.plugin, mF.target as TFile, mF.indexedPath)
                if (eF) {
                    fieldValueManager(mF.plugin, mF.id, mF.fileClassName, mF.target, eF, mF.indexedPath, undefined, undefined, undefined, this.previousModal)?.openModal()
                    this.close()
                    // const thisFieldManager = new FieldManager[eF.field.type](this.plugin, eF.field)
                    // thisFieldManager.createAndOpenFieldModal(this.file, eF.field.name, eF, eF.indexedPath, undefined, undefined, undefined, this.previousModal)
                }
            }
            if (item instanceof ExistingField) {
                // child field exists: go to child field
                switch (item.field.type) {
                    case "Boolean":
                        this.managedField.save(!this.managedField.value)
                        await reOpen()
                        break;
                    case "Cycle":
                        const nextOptions = getNextOption(this.managedField as IFieldManager<TFile, TypesOptionsMap["Cycle"]>)
                        this.managedField.save(nextOptions)
                        await reOpen()
                        break;
                    default:
                        const cF = item.field // child field
                        fieldValueManager(mF.plugin, cF.id, cF.fileClassName, mF.target, item, item.indexedPath, undefined, undefined, undefined, this)?.openModal()
                        // fieldManager.createAndOpenFieldModal(this.file, field.name, item, item.indexedPath, undefined, undefined, undefined, this)
                        break;
                }
            } else {
                //insert a new field
                if (item.type === "ObjectList") {
                    await postValues(mF.plugin, [{ indexedPath: `${mF.indexedPath}____${item.id}`, payload: { value: "" } }], mF.target)
                    this.open()
                } else if (item.type === "Object") {
                    await postValues(mF.plugin, [{ indexedPath: `${mF.indexedPath}____${item.id}`, payload: { value: "" } }], mF.target)
                    await mF.plugin.fieldIndex.indexFields() // FIXME is it necessary ???
                    const cF = await Note.getExistingFieldForIndexedPath(mF.plugin, mF.target as TFile, `${mF.indexedPath}____${item.id}`)
                    fieldValueManager(mF.plugin, item.id, item.fileClassName, mF.target, cF, cF?.indexedPath, undefined, undefined, undefined, this)?.openModal()
                    // const fieldManager = new FieldManager[item.type](this.plugin, item) as F
                    // fieldManager.createAndOpenFieldModal(this.file, item.name, undefined, `${this.indexedPath}____${item.id}`, this.lineNumber, this.asList, this.asBlockquote, this)
                } else {
                    fieldValueManager(mF.plugin, item.id, item.fileClassName, mF.target, undefined, `${mF.indexedPath}____${item.id}`, undefined, undefined, undefined, this)
                    // const fieldManager = new FieldManager[item.type](this.plugin, item) as F
                    // fieldManager.createAndOpenFieldModal(this.file, item.name, undefined, `${this.indexedPath}____${item.id}`, this.lineNumber, this.asList, this.asBlockquote, this)
                }
            }
        }
    }
}

export function displayValue(managedField: IFieldManager<Target, Options>, container: HTMLDivElement, onClicked = () => { }) {
    container.setText(getObjectDescription(managedField, managedField.value))
}

export function createDvField(
    managedField: IFieldManager<Target, Options>,
    dv: any,
    p: any,
    fieldContainer: HTMLElement,
    attrs: { cls?: string, attr?: Record<string, string>, options?: Record<string, string> } = {}
): void {
    return AbstractObject.createDvField(managedField, dv, p, fieldContainer, attrs)
}

export function actions(plugin: MetadataMenu, field: LegacyField, file: TFile, location: ActionLocation, indexedPath: string | undefined, noteField?: NoteFieldsComponent): void {
    const iconName = getIcon(mapFieldType(field.type));
    if (noteField) {
        const action = async () => await noteField.moveToObject(`${indexedPath}`);
        if (isFieldActions(location)) {
            location.addOption(iconName, action, `Go to ${field.name}'s fields`);
        }
    } else {
        const name = field.name
        const action = async () => {
            //create an optionList for this indexedPath
            const note = await Note.buildNote(plugin, file)
            const _eF = note.existingFields.find(__eF => __eF.indexedPath === indexedPath)
            if (_eF) {
                fieldValueManager(plugin, _eF.field.id, _eF.field.fileClassName, file, _eF, _eF.indexedPath, undefined, undefined, undefined, undefined)?.openModal()
            } else {
                const fieldCommandSuggestModal = new FieldCommandSuggestModal(plugin.app)
                const optionsList = new OptionsList(plugin, file, fieldCommandSuggestModal, indexedPath)
                await optionsList.createExtraOptionList()
            }
        }
        if (isSuggest(location)) {
            location.options.push({
                id: `update_${name}`,
                actionLabel: `<span>Update <b>${name}</b></span>`,
                action: action,
                icon: iconName
            });
        }
    }
}

export function getOptionsStr(managedField: IFieldManager<Target, Options>): string {
    return AbstractObject.getOptionsStr(managedField)
}

export function validateValue(managedField: IFieldManager<Target, Options>): boolean {
    return true
}


//#region utils
export function getObjectDescription(managedField: IFieldManager<Target, Options>, value: FrontmatterObject = {}): string {
    let template = managedField.options.displayTemplate
    if (!template) {
        const children = managedField.getChildren()
        const childrenNames = children.map(c => c.name)
        return childrenNames.join(", ")
        /*
        const items = []
        for (const [key, _value] of Object.entries(value)) {
            if (childrenNames.includes(key)) {
                if (typeof _value === "object") {
                    const child = children.find(c => c.name === key)!
                    const cFM = new FM[child.type](this.plugin, child) as ObjectListField | ObjectField
                    items.push(cFM.getObjectDescription(_value))
                } else {
                    items.push(`${_value}`)
                }
            } else {
                items.push(`(${key}?)`)
            }
        }
        return items.join(", ") || `(${this.field.name}?)`
        */

    } else {
        const items: { pattern: string, value: string }[] = []
        const defaultDisplay = (pattern: string) => {
            items.push({ pattern: pattern, value: `(${pattern}?)` })
        }
        const children = managedField.getChildren()
        const childrenNames = children.map(c => c.name)
        const templatePathRegex = new RegExp(`\\{\\{(?<pattern>[^\\}]+?)\\}\\}`, "gu");
        const tP = template.matchAll(templatePathRegex)
        let next = tP.next();
        while (!next.done) {
            if (next.value.groups) {
                const pattern = next.value.groups.pattern
                if (childrenNames.includes(pattern)) {
                    try {
                        const _value = (new Function("value", `return value['${pattern}']`))(value)
                        if (["number", "string", "boolean"].includes(typeof _value)) {
                            items.push({ pattern: pattern, value: _value })
                        } else if (typeof _value === "object") {
                            const child = children.find(c => c.name === pattern)!
                            if (objectTypes.includes(child.type)) {
                                const cFVM = fieldValueManager(managedField.plugin, child.id, child.fileClassName, managedField.target, undefined, undefined)
                                items.push({ pattern: pattern, value: getObjectDescription(cFVM as IFieldManager<Target, Options>, _value) })
                                // const cFM = new FM[child.type](this.plugin, child) as ObjectField | ObjectListField
                                // items.push({ pattern: pattern, value: cFM.getObjectDescription(_value) })
                            } else {
                                defaultDisplay(pattern)
                            }
                        } else {
                            defaultDisplay(pattern)
                        }
                    } catch (e) {
                        defaultDisplay(pattern)
                    }
                } else {
                    defaultDisplay(pattern)
                }
            }
            next = tP.next()
        }
        for (const item of items) {
            template = template.replace(`{{${item.pattern}}}`, item.value)
        }
        return template
    }
}

//#endregion