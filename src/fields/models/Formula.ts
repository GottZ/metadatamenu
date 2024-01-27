import MetadataMenu from "main"
import { TFile, TextAreaComponent, ToggleComponent } from "obsidian"
import { updateFormulas } from "src/commands/updateFormulas"
import { Status, statusIcon } from "src/types/lookupTypes"
import { Constructor } from "src/typings/types"
import { ActionLocation, IFieldManager, LegacyField, Target, isFieldActions, isSingleTargeted, isSuggest, removeValidationError } from "../Field"
import { BaseOptions, IFieldBase } from "../base/BaseField"
import { ISettingsModal } from "../base/BaseSetting"

export class Base implements IFieldBase {
    type = <const>"Formula"
    tagName = "formula"
    icon = "function-square"
    tooltip = "Accepts a formula"
    colorClass = "lookup"
}

export interface Options extends BaseOptions { }
export interface DefaultedOptions extends Options { }
export const DefaultOptions: DefaultedOptions = {}

export function settingsModal(Base: Constructor<ISettingsModal<DefaultedOptions>>): Constructor<ISettingsModal<Options>> {
    return class InputSettingModal extends Base {
        createSettingContainer = () => {
            const container = this.optionsContainer
            const autoUpdateTopContainer = container.createDiv({ cls: "vstacked" });
            const autoUpdateContainer = autoUpdateTopContainer.createDiv({ cls: "field-container" })
            autoUpdateContainer.createEl("span", { text: "Auto update this field ", cls: 'label' });
            autoUpdateContainer.createDiv({ cls: "spacer" });
            const autoUpdate = new ToggleComponent(autoUpdateContainer);
            autoUpdateTopContainer.createEl("span", { text: "This could lead to latencies depending on the queries", cls: 'sub-text warning' });

            if (this.field.options.autoUpdate === undefined) this.field.options.autoUpdate = false
            autoUpdate.setValue(this.field.options.autoUpdate);
            autoUpdate.onChange(value => {
                this.field.options.autoUpdate = value
            })

            const formulaTopContainer = container.createDiv({ cls: "vstacked" });
            formulaTopContainer.createEl("span", { text: "javascript formula", cls: 'label' });
            formulaTopContainer.createEl("span", { text: "current and dv variables are available", cls: 'sub-text' });
            const formulaContainer = formulaTopContainer.createDiv({ cls: "field-container" });
            const formula = new TextAreaComponent(formulaContainer);
            formula.inputEl.addClass("full-width");
            formula.inputEl.cols = 50;
            formula.inputEl.rows = 4;
            formula.setValue(this.field.options.formula || "");
            formula.setPlaceholder("example: current.apple + current.bananas - 3");

            formula.onChange(value => {
                this.field.options.formula = value;
                removeValidationError(formula);
            })
        }

        validateOptions(): boolean {
            return true
        }
    }
}

export function displayValue(managedField: IFieldManager<Target, Options>, container: HTMLDivElement, onClicked = () => { }) {
    if (!isSingleTargeted(managedField)) return
    const fileClassName = managedField.plugin.fieldIndex.filesFields.get(managedField.target.path)?.find(f => f.id === managedField.id)?.fileClassName || "presetField"
    container.createDiv({ text: managedField.plugin.fieldIndex.fileFormulaFieldLastValue.get(`${managedField.target.path}__calculated__${fileClassName}___${managedField.name}`) })
}

export function actions(plugin: MetadataMenu, field: LegacyField, file: TFile, location: ActionLocation, indexedPath?: string): void {
    const name = field.name;
    const f = plugin.fieldIndex;
    const id = `${file.path}__${name}`;
    const status = f.fileFormulaFieldsStatus.get(id) as Status || Status.changed
    if (!field.options.autoUpdate && field.options.autoUpdate !== undefined) {
        const action = async () => {
            await updateFormulas(plugin, { file: file, fieldName: name })
            f.applyUpdates()
        };
        const icon = statusIcon[status]
        if (isSuggest(location) && [Status.changed, Status.mayHaveChanged].includes(status)) {
            location.options.push({
                id: `update_${name}`,
                actionLabel: `<span>Update <b>${name}</b></span>`,
                action: action,
                icon: icon
            });
        } else if (isFieldActions(location) && [Status.changed, Status.mayHaveChanged].includes(status)) {
            location.addOption(icon, action, `Update ${name}'s value`);
        } else if (isFieldActions(location) && status === Status.upToDate) {
            location.addOption(icon, () => { }, `${name} is up to date`);
        } else if (isFieldActions(location) && status === Status.error) {
            location.addOption(icon, () => { }, `${name} has an error`);
        }
    } else if (isFieldActions(location)) {
        const icon = status === Status.error ? statusIcon['error'] : "server-cog"
        location.addOption(icon, () => { }, `${name} is auto-updated`, "disabled");
    }
}

export function validateValue(managedField: IFieldManager<Target, Options>): boolean {
    return true
}

