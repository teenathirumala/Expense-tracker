//  Checks req.params, req.query and req.body against the Zod schemas you pass in.
//  - If anything is invalid: responds 400 with a list of { field, message } and stops.
//  - If everything is valid: puts the cleaned values on req.valid.body / .query / .params
//    and calls next(), so the route handler runs.

export default function validate(schemas) {
  return (req, res, next) => {
    req.valid={}
    const errors=[];
    for(const part of ["params","query","body"]){
       const schema=schemas[part];
       if(!schema)continue;
       const result= schema.safeParse(req[part] ?? {});
       if(result.success){
        req.valid[part] = result.data;//cleaned data
       }else {
        for (const issue of result.error.issues) {
          errors.push({ field: issue.path.join(".") || part, message: issue.message });
        }
    }

    }
    if (errors.length > 0) {
            return res.status(400).json({ message: "Validation failed", errors, requestId: req.id });
    }
    next();
  };
}