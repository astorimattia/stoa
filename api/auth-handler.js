import {getAuth} from './_auth.js'
import {runAuthNode} from './_auth-node.js'
export default async function handler(req,res){return runAuthNode(req,res,getAuth())}
