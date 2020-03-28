"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const utils_1 = require("./utils");
const metaProp = "meta", metaMarker = "@meta", separator = "\n";
function metaMerge(schemaInPath, overlayInPath, defaultMeta, schemaOutPath, overlayOutPath, commentsOutPath, allowExisting = false, cleanDescriptions = false, ignoreComments = false, relaxedStructure = false, returnOverlay = false) {
    function mergeMeta(item, overlay) {
        const es6Meta = "`" + ((defaultMeta && fs.readFileSync(defaultMeta).toString()) || '{ label: "${utils.toProperCase(item.name)}", readonly: false, templates: ["list", "crud"] }') + "`";
        item[metaProp] = JSON.parse(utils_1.convert(eval(es6Meta)));
        if (item.description) {
            const [description, meta] = item.description.split(metaMarker);
            if (meta && !ignoreComments) {
                item[metaProp] = utils_1.merge(item[metaProp], relaxedStructure, JSON.parse(utils_1.convert(meta)));
            }
            if (cleanDescriptions)
                item.description = description ? item.description.split(separator + metaMarker)[0] : "";
        }
        if (overlay) {
            const overlayItem = overlay.find((oi) => oi.name == item.name);
            if (overlayItem && overlayItem[metaProp])
                item[metaProp] = utils_1.merge(item[metaProp], relaxedStructure, overlayItem[metaProp]);
        }
    }
    ;
    function comment(description, meta) {
        if (!meta)
            return description;
        const metaWithMarker = metaMarker + '(' + utils_1.stringify(meta) + ')';
        if (!description)
            return metaWithMarker;
        description = description.split(metaMarker)[0];
        if (description.length == 0)
            return metaWithMarker;
        return description + separator + metaWithMarker;
    }
    let schema = JSON.parse(fs.readFileSync(schemaInPath).toString());
    const overlayIn = overlayInPath && JSON.parse(fs.readFileSync(overlayInPath).toString());
    schema.data.__schema.types
        .filter((ft) => ft.kind == "OBJECT" && ft.name !== "Query" && ft.interfaces.length > 0 && ft.interfaces[0].name == "Node")
        .forEach((t) => {
        if (!allowExisting && t.hasOwnProperty(metaProp))
            throw new Error(`The schema already contains metadata (for table ${t.name})`);
        mergeMeta(t, overlayIn);
        t.fields
            .filter((f) => f.name !== "nodeId" && (f.type.kind == "SCALAR" || (f.type["ofType"] && f.type.ofType["kind"] == "SCALAR")))
            .forEach((f) => {
            if (!allowExisting && f.hasOwnProperty(metaProp))
                throw new Error(`The schema already contains metadata (for field ${f.name})`);
            mergeMeta(f, overlayIn && overlayIn.find((oi) => oi.name == t.name).fields);
        });
    });
    if (schemaOutPath)
        fs.writeFileSync(schemaOutPath, JSON.stringify(schema, null, 2));
    const overlayOut = schema.data.__schema.types
        .filter((ft) => ft.hasOwnProperty(metaProp))
        .map((m) => {
        return { name: m.name, description: m.description,
            fields: m.fields
                .filter((ff) => ff.hasOwnProperty(metaProp))
                .map((fm) => { return { name: fm.name, description: fm.description, meta: fm[metaProp] }; }), meta: m[metaProp] };
    });
    if (overlayOutPath)
        fs.writeFileSync(overlayOutPath, JSON.stringify(overlayOut, null, 2));
    if (commentsOutPath)
        fs.writeFileSync(commentsOutPath, overlayOut.map((t) => `COMMENT ON TABLE ${t.name.toLowerCase()} IS '${comment(t.description, t[metaProp])}';
` + t.fields.map((f) => `COMMENT ON COLUMN ${t.name.toLowerCase()}.${f.name} IS '${comment(f.description, f[metaProp])}';
`).join("")).join("\n"));
    return schema;
}
exports.metaMerge = metaMerge;
